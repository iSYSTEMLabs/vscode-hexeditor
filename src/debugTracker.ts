import { ExtensionHostMessageHandler, MessageType } from "../shared/protocol";
import { HexEditorRegistry } from "./hexEditorRegistry";

import * as vscode from "vscode";

let allVariables: any[] = [];

const addressRe = /^0x[a-f0-9]+$/i;
const decimalRe = /^[0-9]+$/i;

export function onMessageReceived(message: any, registry: HexEditorRegistry) {

    if (message.type === "event" && message.event === "stopped") {
        registry.refreshAllEditors();
        allVariables = [];
    }
    else if (message.type === "response" && (["setVariable", "setExpression", "writeMemory"].includes(message.command))) {
        registry.refreshAllEditors();
    }
    else if (message.type === "response" && (["variables"].includes(message.command))) {
        allVariables = allVariables.concat(message.body.variables);
    }
}

export const showGoToVariable = (messaging: ExtensionHostMessageHandler, baseAddress: number): void => {

    const input = vscode.window.createQuickPick();
    input.items = allVariables.map(value => ({ label: value.name, description: value.memoryReference }));

    if (input.items.length <= 0) {
        input.placeholder = "No variables found, make sure they are expanded in the variables view.";
    } else {
        input.placeholder = "Select variable";
    }

    messaging.sendEvent({ type: MessageType.StashDisplayedOffset });

    let lastValue: number | undefined;
    let accepted = false;

    input.onDidChangeActive(item => {

        const value = item[0]?.description;

        if (!value) {
            lastValue = undefined;
        } else if (addressRe.test(value)) {
            lastValue = parseInt(value.slice(2), 16);
        } else if (decimalRe.test(value)) {
            lastValue = parseInt(value, 10);
        } else {
            return;
        }

        if (lastValue !== undefined) {
            messaging.sendEvent({ type: MessageType.GoToOffset, offset: lastValue });
        }
    });

    input.onDidAccept(() => {
        accepted = true;
        if (lastValue !== undefined) {
            //for small offsets(less than one page), just set focused byte
            if (Math.abs(lastValue - baseAddress) <= 4096) {
                messaging.sendEvent({ type: MessageType.SetFocusedByte, offset: lastValue });
            }
            //large offsets can cause problems as pages are skipped. Open new window instead
            else {
                vscode.commands.executeCommand("TASKING-hexEditor.openDebugMemory", lastValue);
            }
        }
        input.hide();
    });

    input.onDidHide(() => {
        if (!accepted) {
            messaging.sendEvent({ type: MessageType.PopDisplayedOffset });
        }
    });

    input.show();
};