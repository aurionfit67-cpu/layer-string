"use client";

import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal";
import { Button } from "./button";
import type { ReactNode } from "react";

export type ConfirmProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "default" | "danger";
};

/** The only confirmation pattern in the app: used before anything destructive. */
export function Confirm({ open, title, body, confirmLabel, onConfirm, onCancel, tone = "default" }: ConfirmProps) {
  const titleId = `confirm-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      titleId={titleId}
      role={tone === "danger" ? "alertdialog" : "dialog"}
      className="w-[min(94vw,440px)]"
    >
      <ModalHeader id={titleId} title={title} />
      <ModalBody className="text-[13px] leading-relaxed text-muted">{body}</ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
