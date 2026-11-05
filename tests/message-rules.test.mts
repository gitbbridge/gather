import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanMessage,
  conversationKey,
  resolveReceiptCopy,
} from "../lib/message-rules.ts";

test("conversation keys reuse one bidder/item thread", () => {
  const input = {
    bidderId: "bidder-1",
    auctionId: "auction-1",
    itemId: "item-1",
  };
  assert.equal(conversationKey(input), conversationKey(input));
  assert.notEqual(
    conversationKey(input),
    conversationKey({ ...input, itemId: "item-2" }),
  );
});

test("message copy is normalized and bounded", () => {
  assert.equal(cleanMessage("  hello\r\nthere  "), "hello\nthere");
  assert.equal(cleanMessage("x".repeat(5000)).length, 4000);
});

test("auction receipt copy inherits unless explicitly overridden", () => {
  const organization = {
    thankYouHeading: "Thank you",
    thankYouMessage: "Org message",
    receiptFooter: "Org footer",
  };
  assert.deepEqual(
    resolveReceiptCopy(organization, {
      inheritsDefaults: true,
      thankYouHeading: "Ignored",
    }),
    organization,
  );
  assert.deepEqual(
    resolveReceiptCopy(organization, {
      inheritsDefaults: false,
      thankYouHeading: "Event thank you",
    }),
    {
      thankYouHeading: "Event thank you",
      thankYouMessage: "Org message",
      receiptFooter: "Org footer",
    },
  );
});
