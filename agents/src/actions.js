export class ActionExecutor {
    constructor(bot, ruleEngine) {
        this.bot = bot;
        this.ruleEngine = ruleEngine;
    }

    async execute(action) {
        // Check if action is allowed by rules
        const allowed = this.ruleEngine.isAllowed(action);

        if (!allowed.permitted) {
            console.log(`[Action] Blocked by rule: ${allowed.reason}`);
            return false;
        }

        const { type, params, raw } = action;

        switch (type) {
            case 'move':
                return await this.handleMove(params);

            case 'goto':
                return await this.handleGoto(params);

            case 'mine':
                return await this.handleMine(params);

            case 'collect':
                return await this.handleCollect(params);

            case 'attack':
                return await this.handleAttack(params);

            case 'craft':
                return await this.handleCraft(params);

            case 'place':
                return await this.handlePlace(params);

            case 'eat':
                return await this.handleEat();

            case 'sleep':
                return await this.handleSleep();

            case 'chat':
                return this.handleChat(raw);

            case 'wait':
                return this.handleWait();

            case 'look':
                return await this.handleLook(params);

            default:
                console.log(`[Action] Unknown action type: ${type}`);
                return false;
        }
    }

    async handleMove(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Move requires a direction');
            return false;
        }

        const direction = params[0].toLowerCase();
        return await this.bot.moveDirection(direction);
    }

    async handleGoto(params) {
        if (!params || params.length < 3) {
            console.log('[Action] Goto requires x, y, z coordinates');
            return false;
        }

        const [x, y, z] = params.map(Number);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.log('[Action] Invalid coordinates');
            return false;
        }

        return await this.bot.goTo(x, y, z);
    }

    async handleMine(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Mine requires a block type');
            return false;
        }

        const blockName = params.join('_').toLowerCase();
        return await this.bot.mineBlock(blockName);
    }

    async handleCollect(params) {
        // For now, collecting is same as mining nearby items
        // Could be extended to pick up dropped items
        if (!params || params.length === 0) {
            console.log('[Action] Collect requires an item name');
            return false;
        }

        const itemName = params.join('_').toLowerCase();
        return await this.bot.mineBlock(itemName);
    }

    async handleAttack(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Attack requires an entity type');
            return false;
        }

        const entityType = params.join('_').toLowerCase();
        return await this.bot.attackEntity(entityType);
    }

    async handleCraft(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Craft requires an item name');
            return false;
        }

        const itemName = params.join('_').toLowerCase();
        return await this.bot.craft(itemName);
    }

    async handlePlace(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Place requires a block name');
            return false;
        }

        const blockName = params.join('_').toLowerCase();
        return await this.bot.placeBlock(blockName);
    }

    async handleEat() {
        return await this.bot.eatFood();
    }

    async handleSleep() {
        return await this.bot.sleep();
    }

    handleChat(message) {
        if (!message || message.trim() === '') {
            console.log('[Action] Chat requires a message');
            return false;
        }

        this.bot.chat(message);
        return true;
    }

    handleWait() {
        console.log('[Action] Waiting...');
        return true;
    }

    async handleLook(params) {
        if (!params || params.length === 0) {
            console.log('[Action] Look requires a direction');
            return false;
        }

        const direction = params[0].toLowerCase();
        const offsets = {
            north: { x: 0, z: -10 },
            south: { x: 0, z: 10 },
            east: { x: 10, z: 0 },
            west: { x: -10, z: 0 },
            up: { y: 10 },
            down: { y: -10 }
        };

        const offset = offsets[direction];
        if (!offset) {
            console.log(`[Action] Unknown direction: ${direction}`);
            return false;
        }

        const pos = this.bot.position;
        return await this.bot.lookAt(
            pos.x + (offset.x || 0),
            pos.y + (offset.y || 0),
            pos.z + (offset.z || 0)
        );
    }
}
