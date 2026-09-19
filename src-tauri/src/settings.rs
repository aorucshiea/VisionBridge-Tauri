//! Settings store.
//!
//! Deliberately reuses Electron's `%APPDATA%/vision-bridge/settings.json` so
//! the ported build picks up an existing configuration (API keys, provider
//! choices, toolbar buttons) with no re-entry. Only run one of the two builds
//! at a time — they would race on this file.

use serde_json::{json, Value};
use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(base).join("vision-bridge");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn settings_path() -> PathBuf {
    data_dir().join("settings.json")
}

/// Mirrors `src/lib/defaults.ts`. Kept in sync by hand — the renderer merges
/// whatever it reads over its own defaults, so a missing key is not fatal.
fn defaults() -> Value {
    json!({
        "vlmProvider": "ollama",
        "vlmModel": "deepseek-ocr:3b",
        "vlmApiKey": "",
        "vlmBaseUrl": "http://127.0.0.1:11434",
        "vlmTranslatePrompt": "Translate the text in the image to natural, fluent Chinese. Output ONLY the translated text, nothing else.",
        "vlmExplainPrompt": "Analyze the image and explain the content in detail in Chinese. Output ONLY the explanation, nothing else.",
        "mode": "VLM",
        "assistantName": "小V",
        "soulPrompt": "称呼我为小V。我说话简洁直接、乐于动手：能调用工具解决的事就直接去做，不空谈。",
        "ocrProvider": "ollama",
        "ocrApiKey": "",
        "ocrBaseUrl": "http://127.0.0.1:11434",
        "ocrModel": "deepseek-ocr:3b",
        "llmProvider": "ollama",
        "llmModel": "rnj-1:8b-instruct-q8_0",
        "llmApiKey": "",
        "llmBaseUrl": "http://127.0.0.1:11434",
        "llmTranslatePrompt": "Translate the following text to Chinese. Output ONLY the translation, nothing else.",
        "llmExplainPrompt": "Explain the following text in detail in Chinese. Output ONLY the explanation, nothing else.",
        "vlm2Provider": "ollama",
        "vlm2Model": "qwen2-vl:7b",
        "vlm2ApiKey": "",
        "vlm2BaseUrl": "http://127.0.0.1:11434",
        "vlm2JsonPrompt": "",
        "llm2Provider": "ollama",
        "llm2Model": "qwen2:7b",
        "llm2ApiKey": "",
        "llm2BaseUrl": "http://127.0.0.1:11434",
        "llm2TranslatePrompt": "",
        "llm2ExplainPrompt": "",
        "enableTextSelection": false,
        "selectionTrigger": "auto",
        "theme": "light",
        "language": "zh",
        "trayIconPath": "",
        "savedConfigurations": [],
        "closeAction": "tray",
        "advancedMode": false,
        "pipelines": [],
        "activePipelineId": null,
        "customNodeKinds": [],
        "toolbarActions": [
            { "id": "translate", "label": "翻译", "prompt": "", "builtin": true, "enabled": true },
            { "id": "explain", "label": "解释", "prompt": "", "builtin": true, "enabled": true }
        ]
    })
}

/// Load settings, layering the file over the defaults so newly added keys exist.
pub fn load() -> Value {
    let mut merged = defaults();
    if let Ok(text) = std::fs::read_to_string(settings_path()) {
        if let Ok(stored) = serde_json::from_str::<Value>(&text) {
            if let (Some(base), Some(saved)) = (merged.as_object_mut(), stored.as_object()) {
                for (k, v) in saved {
                    base.insert(k.clone(), v.clone());
                }
            }
        }
    }
    merged
}

pub fn save(value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(settings_path(), text).map_err(|e| e.to_string())
}
