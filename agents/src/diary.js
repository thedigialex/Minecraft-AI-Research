import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class Diary {
    constructor(agentName, logsDir = '/app/logs') {
        this.agentName = agentName;
        this.logsDir = logsDir;

        // Ensure logs directory exists
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }

        // Create diary file path with date
        const date = new Date().toISOString().split('T')[0];
        this.filePath = join(logsDir, `${agentName.toLowerCase()}_diary_${date}.log`);

        // Write diary header
        this.writeHeader();
    }

    writeHeader() {
        const header = `
${'='.repeat(60)}
DIARY: ${this.agentName}
Started: ${new Date().toISOString()}
${'='.repeat(60)}

`;
        appendFileSync(this.filePath, header);
    }

    // Log a complete thought cycle
    logThoughtCycle(entry) {
        const timestamp = new Date().toISOString();
        const divider = '-'.repeat(40);

        let content = `
${divider}
[${timestamp}] THOUGHT CYCLE
${divider}

`;

        // Observations
        if (entry.observations) {
            content += `OBSERVATIONS:
  Position: (${entry.observations.position?.x?.toFixed(1)}, ${entry.observations.position?.y?.toFixed(1)}, ${entry.observations.position?.z?.toFixed(1)})
  Health: ${entry.observations.health}/20
  Hunger: ${entry.observations.food}/20
  Time: ${entry.observations.timeOfDay}
  Weather: ${entry.observations.weather}
  Nearby Blocks: ${entry.observations.nearbyBlocks?.slice(0, 5).join(', ') || 'none'}
  Nearby Entities: ${entry.observations.nearbyEntities?.map(e => e.type).join(', ') || 'none'}
  Inventory: ${entry.observations.inventory?.slice(0, 5).map(i => `${i.name}x${i.count}`).join(', ') || 'empty'}

`;
        }

        // Current goal context
        if (entry.goal) {
            content += `CURRENT GOAL:
  ${entry.goal}

`;
        }

        // LLM reasoning (the raw response before parsing)
        if (entry.reasoning) {
            content += `REASONING:
  ${entry.reasoning.replace(/\n/g, '\n  ')}

`;
        }

        // Parsed action
        if (entry.action) {
            content += `DECISION:
  Action: ${entry.action.type}
  Parameters: ${entry.action.params?.join(' ') || 'none'}

`;
        }

        // Action result
        if (entry.result !== undefined) {
            content += `RESULT:
  Success: ${entry.result.success}
  ${entry.result.message ? `Message: ${entry.result.message}` : ''}

`;
        }

        // Rule violations if any
        if (entry.ruleViolation) {
            content += `RULE VIOLATION:
  Blocked: ${entry.ruleViolation.reason}

`;
        }

        appendFileSync(this.filePath, content);
    }

    // Log a simple message
    log(message, category = 'INFO') {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] [${category}] ${message}\n`;
        appendFileSync(this.filePath, line);
    }

    // Log an error
    error(message, error) {
        const timestamp = new Date().toISOString();
        const content = `[${timestamp}] [ERROR] ${message}
  ${error?.message || error}
  ${error?.stack || ''}

`;
        appendFileSync(this.filePath, content);
    }

    // Log agent startup
    logStartup(config) {
        const content = `
AGENT CONFIGURATION:
  Name: ${config.name}
  Personality: ${config.personality}
  Goal: ${config.goal}
  Rules:
${config.rules?.map(r => `    - ${r}`).join('\n') || '    (none)'}

AGENT STARTED
${'='.repeat(60)}

`;
        appendFileSync(this.filePath, content);
    }

    // Log inter-agent communication
    logCommunication(direction, otherAgent, message) {
        const timestamp = new Date().toISOString();
        const arrow = direction === 'sent' ? '->' : '<-';
        const content = `[${timestamp}] [CHAT] ${this.agentName} ${arrow} ${otherAgent}: ${message}\n`;
        appendFileSync(this.filePath, content);
    }

    // Log significant events
    logEvent(eventType, details) {
        const timestamp = new Date().toISOString();
        const content = `[${timestamp}] [EVENT:${eventType.toUpperCase()}] ${JSON.stringify(details)}\n`;
        appendFileSync(this.filePath, content);
    }

    // Get the diary file path
    getFilePath() {
        return this.filePath;
    }
}
