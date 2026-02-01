import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPkg;
import collectBlockPkg from 'mineflayer-collectblock';
const collectBlock = collectBlockPkg.plugin || collectBlockPkg;
import pvpPkg from 'mineflayer-pvp';
const pvp = pvpPkg.plugin || pvpPkg;
import minecraftData from 'minecraft-data';

export class Bot {
    constructor(options) {
        this.options = options;
        this.bot = null;
        this.spawned = false;
        this.movements = null;
    }

    async waitForSpawn() {
        return new Promise((resolve, reject) => {
            this.bot = mineflayer.createBot(this.options);

            // Load plugins
            this.bot.loadPlugin(pathfinder);
            this.bot.loadPlugin(collectBlock);
            this.bot.loadPlugin(pvp);

            this.bot.once('spawn', () => {
                console.log(`[Bot] Spawned at ${this.position.x}, ${this.position.y}, ${this.position.z}`);

                // Initialize pathfinder movements
                this.movements = new Movements(this.bot);
                this.bot.pathfinder.setMovements(this.movements);

                this.spawned = true;
                resolve();
            });

            this.bot.on('error', (error) => {
                console.error('[Bot] Error:', error.message);
                if (!this.spawned) {
                    reject(error);
                }
            });

            this.bot.on('kicked', (reason) => {
                console.log('[Bot] Kicked:', reason);
            });

            this.bot.on('end', () => {
                console.log('[Bot] Disconnected');
                this.spawned = false;
            });

            this.bot.on('death', () => {
                console.log('[Bot] Died, respawning...');
            });

            this.bot.on('health', () => {
                if (this.bot.health < 10) {
                    console.log(`[Bot] Low health: ${this.bot.health}`);
                }
            });
        });
    }

    get position() {
        return this.bot?.entity?.position || { x: 0, y: 0, z: 0 };
    }

    get health() {
        return this.bot?.health || 0;
    }

    get food() {
        return this.bot?.food || 0;
    }

    get inventory() {
        return this.bot?.inventory?.items() || [];
    }

    get players() {
        return Object.values(this.bot?.players || {});
    }

    get entities() {
        return Object.values(this.bot?.entities || {});
    }

    get time() {
        return this.bot?.time?.timeOfDay || 0;
    }

    get isRaining() {
        return this.bot?.isRaining || false;
    }

    // Movement methods
    async moveDirection(direction) {
        const moves = {
            north: { x: 0, z: -5 },
            south: { x: 0, z: 5 },
            east: { x: 5, z: 0 },
            west: { x: -5, z: 0 }
        };

        const move = moves[direction.toLowerCase()];
        if (!move) {
            console.log(`[Bot] Unknown direction: ${direction}`);
            return false;
        }

        const target = this.position.offset(move.x, 0, move.z);
        return this.goTo(target.x, target.y, target.z);
    }

    async goTo(x, y, z) {
        try {
            const goal = new goals.GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z));
            await this.bot.pathfinder.goto(goal);
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to navigate: ${error.message}`);
            return false;
        }
    }

    async lookAt(x, y, z) {
        try {
            await this.bot.lookAt({ x, y, z });
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to look: ${error.message}`);
            return false;
        }
    }

    // Block interaction
    findNearbyBlocks(blockName, maxDistance = 32) {
        const mcData = minecraftData(this.bot.version);
        const blockType = mcData.blocksByName[blockName];

        if (!blockType) {
            return [];
        }

        return this.bot.findBlocks({
            matching: blockType.id,
            maxDistance: maxDistance,
            count: 10
        });
    }

    async mineBlock(blockName) {
        const positions = this.findNearbyBlocks(blockName);

        if (positions.length === 0) {
            console.log(`[Bot] No ${blockName} found nearby`);
            return false;
        }

        const block = this.bot.blockAt(positions[0]);

        if (!block) {
            return false;
        }

        try {
            await this.bot.collectBlock.collect(block);
            console.log(`[Bot] Mined ${blockName}`);
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to mine: ${error.message}`);
            return false;
        }
    }

    async placeBlock(blockName) {
        const item = this.bot.inventory.items().find(i => i.name === blockName);

        if (!item) {
            console.log(`[Bot] No ${blockName} in inventory`);
            return false;
        }

        try {
            await this.bot.equip(item, 'hand');
            const referenceBlock = this.bot.blockAt(this.position.offset(0, -1, 0));

            if (referenceBlock) {
                await this.bot.placeBlock(referenceBlock, { x: 0, y: 1, z: 0 });
                console.log(`[Bot] Placed ${blockName}`);
                return true;
            }
        } catch (error) {
            console.log(`[Bot] Failed to place: ${error.message}`);
        }

        return false;
    }

    // Combat
    async attackEntity(entityType) {
        const entity = this.bot.nearestEntity(e =>
            e.type === entityType || e.name === entityType
        );

        if (!entity) {
            console.log(`[Bot] No ${entityType} found nearby`);
            return false;
        }

        try {
            this.bot.pvp.attack(entity);
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to attack: ${error.message}`);
            return false;
        }
    }

    // Inventory
    async eatFood() {
        const food = this.bot.inventory.items().find(i => i.foodPoints);

        if (!food) {
            console.log('[Bot] No food in inventory');
            return false;
        }

        try {
            await this.bot.equip(food, 'hand');
            await this.bot.consume();
            console.log(`[Bot] Ate ${food.name}`);
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to eat: ${error.message}`);
            return false;
        }
    }

    async craft(itemName) {
        const mcData = minecraftData(this.bot.version);
        const item = mcData.itemsByName[itemName];

        if (!item) {
            console.log(`[Bot] Unknown item: ${itemName}`);
            return false;
        }

        const recipes = this.bot.recipesFor(item.id);

        if (recipes.length === 0) {
            console.log(`[Bot] No recipe for ${itemName}`);
            return false;
        }

        try {
            await this.bot.craft(recipes[0], 1);
            console.log(`[Bot] Crafted ${itemName}`);
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to craft: ${error.message}`);
            return false;
        }
    }

    // Communication
    chat(message) {
        this.bot.chat(message);
    }

    // Sleep
    async sleep() {
        const bed = this.bot.findBlock({
            matching: block => block.name.includes('bed'),
            maxDistance: 32
        });

        if (!bed) {
            console.log('[Bot] No bed found nearby');
            return false;
        }

        try {
            await this.bot.sleep(bed);
            console.log('[Bot] Sleeping...');
            return true;
        } catch (error) {
            console.log(`[Bot] Failed to sleep: ${error.message}`);
            return false;
        }
    }

    disconnect() {
        if (this.bot) {
            this.bot.quit();
        }
    }
}
