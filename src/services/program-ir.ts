// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Strictly Typed Program IR / AST Foundation (Shared Target for Future Blockly & CodeMirror 6 Side-by-Side)

export type IrScalarType = 'int32' | 'uint16' | 'uint8' | 'float' | 'bool' | 'char';

export interface IrVariableDecl {
  name: string;
  type: IrScalarType;
  initialValue: string | number | boolean;
  isConst?: boolean;
}

export type IrStatement =
  | { kind: 'call'; target: string; args: string[]; sourceBlockId?: string }
  | { kind: 'assign'; variable: string; expression: string; sourceBlockId?: string }
  | { kind: 'if'; condition: string; thenBody: IrStatement[]; elseBody?: IrStatement[]; sourceBlockId?: string }
  | { kind: 'interval'; timerName: string; intervalMs: number; body: IrStatement[]; sourceBlockId?: string }
  | { kind: 'comment'; text: string; sourceBlockId?: string }
  | { kind: 'raw'; code: string; sourceBlockId?: string };

export interface IrFunctionDecl {
  name: string;
  returnType: IrScalarType | 'void';
  params: Array<{ name: string; type: IrScalarType }>;
  body: IrStatement[];
}

export interface ProgramIR {
  schema: 'kcomp-ir/1';
  boardId: string;
  includes: string[];
  globals: IrVariableDecl[];
  setup: IrStatement[];
  loop: IrStatement[];
  helpers: IrFunctionDecl[];
}

export function createEmptyProgramIR(boardId: string): ProgramIR {
  return {
    schema: 'kcomp-ir/1',
    boardId,
    includes: [],
    globals: [],
    setup: [],
    loop: [],
    helpers: []
  };
}
