export class LLMClient {
    constructor(host, model) {
        this.host = host;
        this.model = model;
        this.timeout = 60000; // 60 second timeout
    }

    async waitForReady(maxRetries = 30, retryDelay = 5000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(`${this.host}/api/tags`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    // Check if our model is available
                    const data = await response.json();
                    const models = data.models || [];
                    const hasModel = models.some(m => m.name.includes(this.model.split(':')[0]));

                    if (hasModel) {
                        return true;
                    }

                    // Model not found, try to pull it
                    console.log(`[LLM] Model ${this.model} not found, pulling...`);
                    await this.pullModel();
                    return true;
                }
            } catch (error) {
                console.log(`[LLM] Waiting for Ollama... (${i + 1}/${maxRetries})`);
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        throw new Error('Ollama not available after maximum retries');
    }

    async pullModel() {
        try {
            const response = await fetch(`${this.host}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.model }),
                signal: AbortSignal.timeout(600000) // 10 minutes for pulling
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.statusText}`);
            }

            // Stream the response to show progress
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(l => l.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.status) {
                            console.log(`[LLM] Pull: ${data.status}`);
                        }
                    } catch {}
                }
            }

            console.log(`[LLM] Model ${this.model} pulled successfully`);
        } catch (error) {
            console.error(`[LLM] Failed to pull model:`, error.message);
            throw error;
        }
    }

    async generate(systemPrompt, userPrompt) {
        try {
            const response = await fetch(`${this.host}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: userPrompt,
                    system: systemPrompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        num_predict: 100 // Keep responses short
                    }
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`LLM request failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response || '';
        } catch (error) {
            console.error('[LLM] Generate error:', error.message);
            return 'ACTION: wait';
        }
    }

    async chat(messages) {
        try {
            const response = await fetch(`${this.host}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        num_predict: 100
                    }
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`LLM chat failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.message?.content || '';
        } catch (error) {
            console.error('[LLM] Chat error:', error.message);
            return 'ACTION: wait';
        }
    }
}
