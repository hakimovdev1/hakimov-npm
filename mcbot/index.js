const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalFollow, GoalXZ } = goals;
const Vec3 = require('vec3');

/**
 * Creates a fully configured Minecraft bot with helper methods.
 *
 * @param {object} options
 * @param {string} options.host
 * @param {number} [options.port=25565]
 * @param {string} options.username
 * @param {string} options.username
 * @param {string} [options.version]
 * @param {boolean} [options.autoReconnect=true]
 * @param {number}  [options.reconnectDelay=5000]
 */
function createBot(options = {}) {
  const {
    host = 'localhost',
    port = 25565,
    username,
    password,
    version,
    autoReconnect = true,
    reconnectDelay = 5000,
    ...rest
  } = options;

  const bot = mineflayer.createBot({ host, port ,username, version, ...rest });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
  });

  if (autoReconnect) {
    bot.on('end', () => setTimeout(() => createBot(options), reconnectDelay));
    bot.on('kicked', () => setTimeout(() => createBot(options), reconnectDelay));
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  /**
   * Walk to coordinates. Returns a Promise that resolves when reached.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} [range=1]
   */
  bot.walkTo = (x, y, z, range = 1) =>
    new Promise((resolve, reject) => {
      bot.pathfinder.setGoal(new GoalNear(x, y, z, range));
      bot.once('goal_reached', resolve);
      bot.pathfinder.once('path_update', (r) => {
        if (r.status === 'noPath') reject(new Error(`No path to (${x}, ${y}, ${z})`));
      });
    });

  /**
   * Follow a player by username continuously.
   * @param {string} username
   * @param {number} [distance=2]
   */
  bot.follow = (username, distance = 2) => {
    const player = bot.players[username]?.entity;
    if (!player) throw new Error(`Player "${username}" not found`);
    bot.pathfinder.setGoal(new GoalFollow(player, distance), true);
  };

  /** Stop all pathfinding movement. */
  bot.stopMoving = () => bot.pathfinder.setGoal(null);

  // ─── Block Interaction ─────────────────────────────────────────────────────

  /**
   * Find, walk to, and dig the nearest block of a given type.
   * @param {string} blockName  e.g. 'oak_log', 'stone'
   * @param {number} [count=1]  how many blocks to collect
   */
  bot.collect = async (blockName, count = 1) => {
    const mcData = require('minecraft-data')(bot.version);
    const blockType = mcData.blocksByName[blockName];
    if (!blockType) throw new Error(`Unknown block: "${blockName}"`);

    for (let i = 0; i < count; i++) {
      const block = bot.findBlock({ matching: blockType.id, maxDistance: 64 });
      if (!block) throw new Error(`Cannot find "${blockName}" within 64 blocks`);
      const { x, y, z } = block.position;
      await bot.walkTo(x, y, z, 3);
      await bot.dig(block);
    }
  };

  /**
   * Walk to a position and dig the block there.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  bot.digAt = async (x, y, z) => {
    const block = bot.blockAt(new Vec3(x, y, z));
    if (!block || block.name === 'air') throw new Error(`No block at (${x}, ${y}, ${z})`);
    await bot.walkTo(x, y, z, 3);
    await bot.dig(block);
  };

  // ─── Combat ────────────────────────────────────────────────────────────────

  /**
   * Walk to and attack the nearest entity matching a name.
   * If no name given, attacks the nearest hostile mob.
   * @param {string} [entityName]  e.g. 'zombie', 'skeleton', a player name
   */
  bot.attackNearest = async (entityName) => {
    const hostiles = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch',
      'blaze', 'ghast', 'slime', 'pillager', 'drowned', 'husk'];

    const entity = Object.values(bot.entities).find((e) => {
      if (e === bot.entity) return false;
      if (entityName) return e.name === entityName || e.username === entityName;
      return hostiles.includes(e.name);
    });

    if (!entity) throw new Error(`No ${entityName ?? 'hostile mob'} found nearby`);

    const { x, y, z } = entity.position;
    await bot.walkTo(x, y, z, 2);
    bot.attack(entity);
  };

  // ─── Inventory ─────────────────────────────────────────────────────────────

  /**
   * Equip an item by name.
   * @param {string} itemName  e.g. 'diamond_sword'
   * @param {'hand'|'head'|'torso'|'legs'|'feet'|'off-hand'} [destination='hand']
   */
  bot.equipItem = async (itemName, destination = 'hand') => {
    const item = bot.inventory.items().find((i) => i.name === itemName);
    if (!item) throw new Error(`"${itemName}" not found in inventory`);
    await bot.equip(item, destination);
  };

  /**
   * Equip the best available item for a slot based on tool tier.
   * @param {'hand'|'head'|'torso'|'legs'|'feet'} slot
   */
  bot.equipBest = async (slot = 'hand') => {
    const tierOrder = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden', 'leather'];
    const items = bot.inventory.items();
    let best = null;

    for (const tier of tierOrder) {
      best = items.find((i) => i.name.startsWith(tier));
      if (best) break;
    }

    if (!best) throw new Error('No equippable item found');
    await bot.equip(best, slot);
  };

  /**
   * Drop items from inventory by name.
   * @param {string} itemName
   * @param {number} [count]  defaults to entire stack
   */
  bot.dropItem = async (itemName, count) => {
    const item = bot.inventory.items().find((i) => i.name === itemName);
    if (!item) throw new Error(`"${itemName}" not found in inventory`);
    await bot.toss(item.type, null, count ?? item.count);
  };

  // ─── Food ──────────────────────────────────────────────────────────────────

  /**
   * Eat a specific food, or the best available food if none specified.
   * @param {string} [foodName]
   */
  bot.eat = async (foodName) => {
    const mcData = require('minecraft-data')(bot.version);
    let food;

    if (foodName) {
      food = bot.inventory.items().find((i) => i.name === foodName);
    } else {
      food = bot.inventory.items()
        .filter((i) => mcData.foodsByName[i.name])
        .sort((a, b) =>
          (mcData.foodsByName[b.name]?.foodPoints ?? 0) -
          (mcData.foodsByName[a.name]?.foodPoints ?? 0)
        )[0];
    }

    if (!food) throw new Error(foodName ? `No "${foodName}" in inventory` : 'No food found');
    await bot.equip(food, 'hand');
    await bot.consume();
  };

  /**
   * Enable background auto-eating when hunger drops below a threshold.
   * Call once after bot spawns.
   * @param {number} [threshold=14]  hunger level (0–20) that triggers eating
   */
  bot.autoEat = (threshold = 14) => {
    let eating = false;
    bot.on('physicsTick', async () => {
      if (bot.food <= threshold && !eating) {
        eating = true;
        try { await bot.eat(); } catch (_) {}
        eating = false;
      }
    });
  };

  // ─── Utility ───────────────────────────────────────────────────────────────

  /**
   * Smoothly look at world coordinates.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {boolean} [force=false]
   */
  bot.lookAtBlock = (x, y, z, force = false) =>
    bot.lookAt(new Vec3(x, y, z), force);

  /**
   * Check if bot has at least `count` of an item.
   * @param {string} itemName
   * @param {number} [count=1]
   */
  bot.has = (itemName, count = 1) =>
    bot.inventory.items()
      .filter((i) => i.name === itemName)
      .reduce((sum, i) => sum + i.count, 0) >= count;

  /**
   * Count total items of a type in inventory.
   * @param {string} itemName
   */
  bot.count = (itemName) =>
    bot.inventory.items()
      .filter((i) => i.name === itemName)
      .reduce((sum, i) => sum + i.count, 0);

  return bot;
}

module.exports = { createBot };
