import { readFileSync } from 'fs';
import { Bot } from './bot.js';
import { LLMClient } from './llm.js';
import { Observer } from './observer.js';
import { ActionExecutor } from './actions.js';
import { RuleEngine } from './rules.js';
import { Diary } from './diary.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Agent';
const AGENT_CONFIG = process.env.AGENT_CONFIG || '/app/configs/agent1.json';
const MINECRAFT_HOST = process.env.MINECRAFT_HOST || 'localhost';
const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT) || 25565;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.1:8b';

// Decision loop interval in milliseconds (15 seconds to reduce memory pressure)
const DECISION_INTERVAL = 15000;

// Garbage collection helper
const runGC = () => {
    if (global.gc) {
        global.gc();
    }
};

async function loadConfig(configPath) {
    try {
        const data = readFileSync(configPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load config from ${configPath}:`, error.message);
        return {
            name: AGENT_NAME,
            goal: "Survive and explore the world",
            rules: [],
            personality: "A curious and helpful Minecraft bot"
        };
    }
}

async function main() {
    console.log(`[${AGENT_NAME}] Starting AI Agent...`);
    console.log(`[${AGENT_NAME}] Minecraft: ${MINECRAFT_HOST}:${MINECRAFT_PORT}`);
    console.log(`[${AGENT_NAME}] Ollama: ${OLLAMA_HOST}`);
    console.log(`[${AGENT_NAME}] Model: ${LLM_MODEL}`);

    // Load agent configuration
    const config = await loadConfig(AGENT_CONFIG);
    console.log(`[${AGENT_NAME}] Loaded config:`, config.name);
    console.log(`[${AGENT_NAME}] Goal:`, config.goal);

    // Initialize diary for thought logging
    const diary = new Diary(config.name || AGENT_NAME);
    diary.logStartup(config);
    console.log(`[${AGENT_NAME}] Diary: ${diary.getFilePath()}`);

    // Initialize LLM client
    const llm = new LLMClient(OLLAMA_HOST, LLM_MODEL);

    // Wait for Ollama to be ready
    console.log(`[${AGENT_NAME}] Waiting for Ollama...`);
    await llm.waitForReady();
    console.log(`[${AGENT_NAME}] Ollama is ready`);

    // Initialize the Minecraft bot
    const bot = new Bot({
        host: MINECRAFT_HOST,
        port: MINECRAFT_PORT,
        username: config.name || AGENT_NAME,
        version: '1.20.4'
    });

    // Wait for bot to spawn
    await bot.waitForSpawn();
    console.log(`[${AGENT_NAME}] Bot spawned in Minecraft`);

    // Initialize components
    const observer = new Observer(bot);
    const ruleEngine = new RuleEngine(config.rules || []);
    const actionExecutor = new ActionExecutor(bot, ruleEngine);

    // Build system prompt for LLM
    const systemPrompt = buildSystemPrompt(config);

    // Main decision loop
    console.log(`[${AGENT_NAME}] Starting decision loop...`);

    async function decisionLoop() {
        const diaryEntry = { goal: config.goal };

        try {
            // Get current observations
            const observations = observer.getObservations();
            diaryEntry.observations = observations;

            // Log inventory for debugging
            const invStr = observations.inventory.slice(0, 10).map(i => `${i.name}x${i.count}`).join(', ') || 'Empty';
            console.log(`[${AGENT_NAME}] Inventory: ${invStr}`);

            // Build prompt with current state
            const userPrompt = buildUserPrompt(observations, config.goal);

            // Get decision from LLM
            const response = await llm.generate(systemPrompt, userPrompt);
            diaryEntry.reasoning = response;

            // Parse and execute action
            const action = parseAction(response);
            diaryEntry.action = action;

            if (action) {
                console.log(`[${AGENT_NAME}] Action: ${action.type} ${action.raw || ''}`);

                // Check rules before execution
                const ruleCheck = ruleEngine.isAllowed(action);
                if (!ruleCheck.permitted) {
                    diaryEntry.ruleViolation = { reason: ruleCheck.reason };
                    diaryEntry.result = { success: false, message: `Blocked: ${ruleCheck.reason}` };
                } else {
                    const success = await actionExecutor.execute(action);
                    diaryEntry.result = { success: !!success };
                }
            } else {
                diaryEntry.result = { success: false, message: 'Could not parse action' };
            }

        } catch (error) {
            console.error(`[${AGENT_NAME}] Decision loop error:`, error.message);
            diary.error('Decision loop error', error);
            diaryEntry.result = { success: false, message: error.message };
        }

        // Log the complete thought cycle to diary
        diary.logThoughtCycle(diaryEntry);

        // Run garbage collection to prevent memory buildup
        runGC();

        // Schedule next decision
        setTimeout(decisionLoop, DECISION_INTERVAL);
    }

    // Start the loop
    decisionLoop();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(`[${AGENT_NAME}] Shutting down...`);
        bot.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log(`[${AGENT_NAME}] Shutting down...`);
        bot.disconnect();
        process.exit(0);
    });
}

function buildSystemPrompt(config) {
    const rulesText = config.rules && config.rules.length > 0
        ? config.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'No specific rules.';

    return `You are ${config.name}, an AI agent in Minecraft.

PERSONALITY: ${config.personality || 'A helpful Minecraft bot'}

YOUR GOAL: ${config.goal}

RULES YOU MUST FOLLOW:
${rulesText}

AVAILABLE ACTIONS (use exactly ONE action per turn):
- move north|south|east|west
- goto <x> <y> <z>
- mine <block_name>
- collect <item_name>
- attack <entity_type>
- craft <item_name>
- place <block_name>
- eat
- sleep
- chat <message>
- wait
- look north|south|east|west|up|down

ACTION FORMAT: Each action takes only ONE parameter (or none). Examples:
- mine oak_log (correct - mines oak logs)
- craft oak_planks (correct - crafts planks from logs)
- craft wooden_pickaxe (correct - crafts pickaxe if you have planks+sticks)
- place crafting_table (correct - places crafting table)
- attack zombie (correct - attacks nearby zombie)

IMPORTANT MINECRAFT KNOWLEDGE:
- You start with NO tools. First gather wood (oak_log, birch_log, etc.) by hand
- Basic crafting (planks, sticks) can be done without a crafting table
- CRAFTING TABLE: Required for tools, weapons, and most items! Craft from 4 planks, then place it
- FURNACE: Required to smelt ores into ingots! Craft from 8 cobblestone, then place it

CRAFTING PROGRESSION:
1. Mine logs by hand (oak_log, birch_log, etc.)
2. Craft logs into planks (1 log = 4 planks)
3. Craft planks into sticks (2 planks = 4 sticks)
4. Craft 4 planks into a crafting_table
5. Place the crafting table, then craft tools near it
6. Craft wooden_pickaxe (3 planks + 2 sticks)
7. Mine stone/cobblestone with wooden pickaxe
8. Craft furnace (8 cobblestone) and stone tools

MINING REQUIREMENTS:
- By hand: dirt, sand, gravel, wood
- Wooden pickaxe: stone, cobblestone, coal_ore
- Stone pickaxe: iron_ore, copper_ore, lapis_ore
- Iron pickaxe: gold_ore, diamond_ore, redstone_ore, emerald_ore

SMELTING (requires furnace + fuel like coal or planks):
- iron_ore + fuel = iron_ingot
- gold_ore + fuel = gold_ingot
- raw food + fuel = cooked food

FARMING:
- Seeds come from breaking TALL GRASS (short_grass/tall_grass), NOT grass_block!
- Farming requires a HOE to till dirt/grass_block into farmland
- Craft wooden_hoe: 2 planks + 2 sticks (needs crafting table)
- Plant seeds on farmland near water for faster growth
- Wheat seeds grow into wheat, which makes bread (3 wheat = 1 bread)

FOOD SOURCES:
- Kill animals (pig, cow, chicken, sheep) for raw meat
- Cook raw meat in furnace for more hunger restoration
- Apples drop rarely from oak leaves
- Bread from wheat (no cooking needed)

IMPORTANT: First explain your reasoning (2-3 sentences), then provide your action.

Response format:
THINKING: <your reasoning about the current situation>
ACTION: <action_name> <single_parameter>

EXAMPLE RESPONSES:
Example 1 - Need wood:
THINKING: I have no tools yet. I need to gather wood first to craft a pickaxe before I can mine stone.
ACTION: mine oak_log

Example 2 - Have logs, need planks:
THINKING: I have oak_log in my inventory. I should craft it into planks for tools.
ACTION: craft oak_planks

Example 3 - Have planks, need sticks:
THINKING: I have planks. Now I need sticks to combine with planks for tools.
ACTION: craft stick

Example 4 - Ready for crafting table:
THINKING: I have 4 planks. I should craft a crafting table so I can make tools.
ACTION: craft crafting_table`;
}

function buildUserPrompt(observations, goal) {
    return `CURRENT STATE:
- Position: ${observations.position.x.toFixed(1)}, ${observations.position.y.toFixed(1)}, ${observations.position.z.toFixed(1)}
- Health: ${observations.health}/20
- Hunger: ${observations.food}/20
- Time: ${observations.timeOfDay}
- Weather: ${observations.weather}

NEARBY BLOCKS:
${observations.nearbyBlocks.slice(0, 10).join(', ') || 'None visible'}

NEARBY ENTITIES:
${observations.nearbyEntities.map(e => `${e.type} (${e.distance.toFixed(1)}m)`).join(', ') || 'None'}

INVENTORY:
${observations.inventory.slice(0, 10).map(i => `${i.name} x${i.count}`).join(', ') || 'Empty'}

YOUR GOAL: ${goal}

Think about your current situation and goal. What action should you take?
Remember to explain your THINKING first, then provide your ACTION.`;
}

function parseAction(response) {
    const match = response.match(/ACTION:\s*(\w+)\s*(.*)/i);
    if (!match) {
        console.log('Could not parse action from response:', response.substring(0, 100));
        return null;
    }

    const [, type, paramsStr] = match;
    const params = paramsStr.trim().split(/\s+/).filter(p => p);

    return {
        type: type.toLowerCase(),
        params: params.length > 0 ? params : undefined,
        raw: paramsStr.trim()
    };
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
