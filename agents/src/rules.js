export class RuleEngine {
    constructor(rules = []) {
        this.rules = this.parseRules(rules);
    }

    parseRules(rules) {
        return rules.map(rule => {
            // Parse rule string into structured format
            // Rules can be in formats like:
            // - "cannot attack players"
            // - "must not mine diamond_ore"
            // - "can only craft wooden tools"
            // - "prohibited: pvp"

            const lowerRule = rule.toLowerCase();

            // Parse prohibition rules
            if (lowerRule.includes('cannot') || lowerRule.includes('must not') ||
                lowerRule.includes('prohibited') || lowerRule.includes('forbidden') ||
                lowerRule.includes('not allowed')) {
                return {
                    type: 'prohibition',
                    original: rule,
                    ...this.extractActionTarget(lowerRule)
                };
            }

            // Parse requirement rules
            if (lowerRule.includes('must') || lowerRule.includes('required') ||
                lowerRule.includes('always')) {
                return {
                    type: 'requirement',
                    original: rule,
                    ...this.extractActionTarget(lowerRule)
                };
            }

            // Parse restriction rules
            if (lowerRule.includes('only') || lowerRule.includes('limit')) {
                return {
                    type: 'restriction',
                    original: rule,
                    ...this.extractActionTarget(lowerRule)
                };
            }

            // Default: treat as general guideline
            return {
                type: 'guideline',
                original: rule,
                action: null,
                target: null
            };
        });
    }

    extractActionTarget(ruleText) {
        // Common action words
        const actions = ['attack', 'mine', 'craft', 'place', 'chat', 'goto', 'move',
                        'collect', 'eat', 'sleep', 'trade', 'steal', 'grief'];

        // Common target categories
        const targetPatterns = {
            players: ['player', 'players', 'pvp', 'other agents'],
            mobs: ['mob', 'mobs', 'monster', 'monsters', 'hostile'],
            passive: ['animal', 'animals', 'passive', 'peaceful'],
            blocks: ['block', 'blocks', 'ore', 'ores'],
            items: ['item', 'items', 'tool', 'tools', 'weapon', 'weapons']
        };

        let foundAction = null;
        let foundTarget = null;

        // Find action
        for (const action of actions) {
            if (ruleText.includes(action)) {
                foundAction = action;
                break;
            }
        }

        // Find target category
        for (const [category, patterns] of Object.entries(targetPatterns)) {
            for (const pattern of patterns) {
                if (ruleText.includes(pattern)) {
                    foundTarget = category;
                    break;
                }
            }
            if (foundTarget) break;
        }

        // Also look for specific block/item names
        const specificTargets = ruleText.match(/\b(diamond|iron|gold|coal|wood|stone|dirt|cobblestone|oak|birch|spruce)\b/);
        if (specificTargets) {
            foundTarget = specificTargets[1];
        }

        return {
            action: foundAction,
            target: foundTarget
        };
    }

    isAllowed(action) {
        const { type, params } = action;

        for (const rule of this.rules) {
            // Skip guidelines - they're just for LLM context
            if (rule.type === 'guideline') continue;

            // Check prohibition rules
            if (rule.type === 'prohibition') {
                if (this.matchesRule(type, params, rule)) {
                    return {
                        permitted: false,
                        reason: rule.original
                    };
                }
            }

            // Restriction rules - more complex, may need context
            if (rule.type === 'restriction') {
                // For now, restrictions are advisory only
                // Could be extended to track state and enforce limits
            }
        }

        return { permitted: true };
    }

    matchesRule(actionType, params, rule) {
        // If rule has a specific action, check if it matches
        if (rule.action && rule.action !== actionType) {
            return false;
        }

        // If rule has a target, check if params match
        if (rule.target && params) {
            const paramStr = params.join(' ').toLowerCase();

            // Check target categories
            if (rule.target === 'players') {
                // For attack actions, we'd need to check entity type
                // This is a simplified check
                return actionType === 'attack' &&
                       (paramStr.includes('player') || !paramStr.includes('zombie'));
            }

            // Check specific materials
            if (paramStr.includes(rule.target)) {
                return true;
            }
        }

        // If rule has action but no target, match any target
        if (rule.action === actionType && !rule.target) {
            return true;
        }

        return false;
    }

    // Add a runtime rule
    addRule(ruleText) {
        const parsed = this.parseRules([ruleText]);
        this.rules.push(...parsed);
    }

    // Remove a rule
    removeRule(ruleText) {
        this.rules = this.rules.filter(r => r.original !== ruleText);
    }

    // Get all rules as strings
    getRules() {
        return this.rules.map(r => r.original);
    }
}
