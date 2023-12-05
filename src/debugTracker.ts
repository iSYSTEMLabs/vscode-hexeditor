import { HexEditorRegistry } from "./hexEditorRegistry";

export function onMessageReceived(message: any, registry: HexEditorRegistry) {

    if (message.type === "event" && message.event === "stopped") {
        registry.refreshAllEditors();
    }
    else if (message.type === "response" && (["setVariable", "setExpression", "writeMemory"].includes(message.command))) {
        registry.refreshAllEditors();
    }
}