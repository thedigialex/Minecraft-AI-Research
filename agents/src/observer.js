export class Observer {
    constructor(bot) {
        this.bot = bot;
    }

    getObservations() {
        return {
            position: this.getPosition(),
            health: this.bot.health,
            food: this.bot.food,
            timeOfDay: this.getTimeOfDay(),
            weather: this.getWeather(),
            nearbyBlocks: this.getNearbyBlocks(),
            nearbyEntities: this.getNearbyEntities(),
            inventory: this.getInventory(),
            biome: this.getBiome()
        };
    }

    getPosition() {
        const pos = this.bot.position;
        return {
            x: pos.x,
            y: pos.y,
            z: pos.z
        };
    }

    getTimeOfDay() {
        const time = this.bot.time;

        if (time >= 0 && time < 6000) return 'morning';
        if (time >= 6000 && time < 12000) return 'day';
        if (time >= 12000 && time < 18000) return 'evening';
        return 'night';
    }

    getWeather() {
        if (this.bot.isRaining) {
            return this.bot.thunderState > 0 ? 'thunderstorm' : 'rain';
        }
        return 'clear';
    }

    getNearbyBlocks() {
        // Simplified: just check the block below and in front
        const pos = this.bot.position;
        const mineflayerBot = this.bot.bot;
        const blocks = [];

        try {
            const below = mineflayerBot.blockAt(pos.offset(0, -1, 0));
            if (below) blocks.push(`standing on: ${below.name}`);

            // Check 4 directions at eye level
            const directions = [
                { x: 1, z: 0, name: 'east' },
                { x: -1, z: 0, name: 'west' },
                { x: 0, z: 1, name: 'south' },
                { x: 0, z: -1, name: 'north' }
            ];

            for (const dir of directions) {
                const block = mineflayerBot.blockAt(pos.offset(dir.x * 2, 0, dir.z * 2));
                if (block && block.name !== 'air') {
                    blocks.push(`${dir.name}: ${block.name}`);
                }
            }
        } catch {
            // Ignore errors
        }

        return blocks;
    }

    getNearbyEntities(maxDistance = 16) {
        const pos = this.bot.position;
        const entities = [];

        try {
            for (const entity of this.bot.entities) {
                if (!entity || !entity.position) continue;
                if (entity === this.bot.bot?.entity) continue; // Skip self

                const distance = pos.distanceTo(entity.position);

                if (distance <= maxDistance) {
                    entities.push({
                        type: entity.type || entity.name || 'unknown',
                        name: entity.username || entity.displayName || entity.name,
                        distance: distance,
                        position: {
                            x: entity.position.x,
                            y: entity.position.y,
                            z: entity.position.z
                        },
                        health: entity.health
                    });
                }

                // Limit to 20 entities max
                if (entities.length >= 20) break;
            }
        } catch (error) {
            console.log('[Observer] Error getting entities:', error.message);
        }

        return entities.sort((a, b) => a.distance - b.distance).slice(0, 10);
    }

    getInventory() {
        return this.bot.inventory.map(item => ({
            name: item.name,
            count: item.count,
            slot: item.slot
        }));
    }

    getBiome() {
        try {
            const block = this.bot.bot.blockAt(this.bot.position);
            return block?.biome?.name || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    // Get detailed info about a specific direction
    lookDirection(direction) {
        const mineflayerBot = this.bot.bot;
        const pos = this.bot.position;

        const offsets = {
            north: { x: 0, z: -10 },
            south: { x: 0, z: 10 },
            east: { x: 10, z: 0 },
            west: { x: -10, z: 0 },
            up: { x: 0, y: 10, z: 0 },
            down: { x: 0, y: -10, z: 0 }
        };

        const offset = offsets[direction.toLowerCase()];
        if (!offset) return null;

        const targetPos = pos.offset(offset.x || 0, offset.y || 0, offset.z || 0);
        const blocks = [];

        // Check blocks in that direction
        for (let i = 1; i <= 10; i++) {
            const checkPos = pos.offset(
                (offset.x || 0) * i / 10,
                (offset.y || 0) * i / 10,
                (offset.z || 0) * i / 10
            );
            const block = mineflayerBot.blockAt(checkPos);

            if (block && block.name !== 'air') {
                blocks.push({
                    name: block.name,
                    distance: i
                });
            }
        }

        return blocks;
    }
}
