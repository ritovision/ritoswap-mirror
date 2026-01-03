"use client";

import React, { useCallback, useState } from "react";
import ConnectModal from "./ConnectModal";
import { useRegisterWalletConnectOpener } from "./connectModalBridge";

export default function WalletModalHost() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useRegisterWalletConnectOpener(handleOpen);

  return <ConnectModal isOpen={open} onClose={handleClose} />;
}
