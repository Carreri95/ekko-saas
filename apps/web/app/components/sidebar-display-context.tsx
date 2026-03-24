"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Value = {
  editorFilename: string | null;
  setEditorFilename: (name: string | null) => void;
};

const SidebarDisplayContext = createContext<Value | null>(null);

export function SidebarDisplayProvider({ children }: { children: ReactNode }) {
  const [editorFilename, setEditorFilenameState] = useState<string | null>(
    null,
  );
  const setEditorFilename = useCallback((name: string | null) => {
    setEditorFilenameState(name);
  }, []);
  const value = useMemo(
    () => ({ editorFilename, setEditorFilename }),
    [editorFilename, setEditorFilename],
  );
  return (
    <SidebarDisplayContext.Provider value={value}>
      {children}
    </SidebarDisplayContext.Provider>
  );
}

export function useSidebarDisplay(): Value {
  const v = useContext(SidebarDisplayContext);
  if (!v) {
    return {
      editorFilename: null,
      setEditorFilename: () => {},
    };
  }
  return v;
}
