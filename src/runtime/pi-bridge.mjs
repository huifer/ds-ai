// ~/pi-discord-agents/src/runtime/pi-bridge.mjs
// Pi Agent RPC 桥接层
// 让 AgentManager 能够调用 Pi Agent 进行 LLM 推理
//
// 用法：
//   const piBridge = new PiBridge({ rpcClient: pi, log });
//   const text = await piBridge.prompt(systemPrompt, userText);
//   const json = await piBridge.promptJSON(systemPrompt, userText);

export class PiBridge {
  constructor({ rpcClient, log = () => {} } = {}) {
    this.rpcClient = rpcClient;
    this.log = log;
    this._callCount = 0;
  }

  get available() {
    return !!this.rpcClient && typeof this.rpcClient.promptAndWait === 'function';
  }

  /**
   * 发送 prompt 并等待 Pi Agent 返回文本
   * @returns {Promise<string|null>} assistant 文本，失败返回 null
   */
  async prompt(systemPrompt, userText, { timeoutMs = 300_000 } = {}) {
    if (!this.available) return null;
    const full = systemPrompt
      ? `<instructions>\n${systemPrompt}\n</instructions>\n\n<input>\n${userText}\n</input>`
      : userText;
    try {
      this._callCount += 1;
      const callId = this._callCount;
      this.log(`[pi-bridge #${callId}] prompt ${userText.length} chars`);
      await this.rpcClient.promptAndWait(full, null, timeoutMs);
    } catch (e) {
      // 超时后仍然尝试获取已生成的响应
      this.log(`[pi-bridge] 超时(${timeoutMs}ms)，尝试获取已生成的响应...`);
    }
    // 无论成功还是超时，都尝试获取响应
    try {
      const text = await this.rpcClient.getLastAssistantText();
      this.log(`[pi-bridge] response ${text?.length ?? 0} chars`);
      return text || null;
    } catch (e2) {
      this.log(`[pi-bridge] 获取响应失败: ${e2.message}`);
      return null;
    }
  }

  /**
   * 发送 prompt 并解析 JSON 响应
   * @returns {Promise<object|null>} 解析后的 JSON，失败返回 null
   */
  async promptJSON(systemPrompt, userText, opts) {
    const text = await this.prompt(
      systemPrompt + '\n\n重要：请用 JSON 格式回复，不要有多余文字。',
      userText,
      opts,
    );
    if (!text) return null;
    // 尝试从 ```json ... ``` 中提取
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try { return JSON.parse(fenced[1].trim()); } catch {}
    }
    // 尝试直接解析裸 JSON
    const raw = text.match(/\{[\s\S]*\}/);
    if (raw) {
      try { return JSON.parse(raw[0]); } catch {}
    }
    this.log(`[pi-bridge] JSON 解析失败，原始响应: ${text.slice(0, 200)}`);
    return null;
  }

  get stats() {
    return { calls: this._callCount, available: this.available };
  }
}
