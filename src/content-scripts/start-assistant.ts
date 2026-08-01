import { adguardAssistant } from '@adguard/assistant';

type AddRuleCallback = (ruleText: string) => void;

export const startAssistant = (() => {
    let assistant: ReturnType<typeof adguardAssistant> | undefined;

    return (addRuleCallback: AddRuleCallback) => {
        if (window.top !== window || !(document.documentElement instanceof HTMLElement)) {
            return;
        }

        if (!assistant) {
            assistant = adguardAssistant();
        } else {
            assistant.close();
        }

        assistant.start(null, addRuleCallback);
    };
})();
