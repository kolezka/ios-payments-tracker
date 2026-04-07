import { Hono } from "hono";
import bplistCreator from "bplist-creator";
import { logger } from "../logger";
import type { User } from "../types";

const shortcut = new Hono();

function makeTextToken(str: string, attachments?: Record<string, { Type: string; VariableName?: string; OutputName?: string }>): Record<string, any> {
  const value: Record<string, any> = { string: str };
  if (attachments) {
    value.attachmentsByRange = attachments;
  }
  return {
    Value: value,
    WFSerializationType: "WFTextTokenString",
  };
}

function makeDictField(key: string, value: Record<string, any>): Record<string, any> {
  return {
    WFItemType: 0,
    WFKey: makeTextToken(key),
    WFValue: value,
  };
}

function makeVariableToken(varName: string): Record<string, any> {
  return makeTextToken("\uFFFC", {
    "{0, 1}": { Type: "Variable", VariableName: varName },
  });
}

function generateShortcutData(apiUrl: string, token: string): Record<string, any> {
  return {
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowImportQuestions: [],
    WFWorkflowTypes: ["WatchKit", "NCWidget"],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4274264319,
      WFWorkflowIconGlyphNumber: 59470,
    },
    WFWorkflowName: "Dodaj Platnosc",
    WFWorkflowActions: [
      // Build JSON from Wallet automation magic variables
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.dictionary",
        WFWorkflowActionParameters: {
          WFItems: {
            Value: {
              WFDictionaryFieldValueItems: [
                makeDictField("amount", makeVariableToken("Amount")),
                makeDictField("seller", makeVariableToken("Merchant")),
                makeDictField("card", makeVariableToken("Card")),
              ],
            },
          },
        },
      },
      // POST to API
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
        WFWorkflowActionParameters: {
          WFURL: `${apiUrl}/api/transactions`,
          WFHTTPMethod: "POST",
          WFHTTPHeaders: {
            Value: {
              WFDictionaryFieldValueItems: [
                makeDictField("Authorization", makeTextToken(`Bearer ${token}`)),
                makeDictField("Content-Type", makeTextToken("application/json")),
              ],
            },
          },
          WFHTTPBodyType: "Json",
          WFJSONValues: {
            Value: {
              WFSerializationType: "WFTextTokenAttachment",
              Value: {
                Type: "ActionOutput",
                OutputName: "Dictionary",
              },
            },
          },
        },
      },
      // Notification
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.notification",
        WFWorkflowActionParameters: {
          WFNotificationActionBody: makeTextToken("\uFFFC zl u \uFFFC", {
            "{0, 1}": { Type: "Variable", VariableName: "Amount" },
            "{6, 1}": { Type: "Variable", VariableName: "Merchant" },
          }),
          WFNotificationActionTitle: "Payment Tracker",
        },
      },
    ],
  };
}

shortcut.get("/download", (c) => {
  const user = c.get("user") as User;
  const apiUrl = process.env.BASE_URL ?? "http://localhost:3010";

  const data = generateShortcutData(apiUrl, user.apiToken);
  const bplist = bplistCreator(data);

  logger.info({ userId: user.id }, "shortcut file downloaded");

  return new Response(bplist, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Dodaj-Platnosc.shortcut"',
    },
  });
});

export default shortcut;
