export const MARK_TYPES = [
  "bold",
  "italic",
  "underline",
  "strike",
  "textColor",
  "backgroundColor",
  "link",
  "fontSize",
  "fontFamily",
] as const;

export type MarkType = (typeof MARK_TYPES)[number];

export interface BoldMark {
  type: "bold";
}

export interface ItalicMark {
  type: "italic";
}

export interface UnderlineMark {
  type: "underline";
}

export interface StrikeMark {
  type: "strike";
}

export interface TextColorMark {
  type: "textColor";
  attrs: {
    color: string;
  };
}

export interface BackgroundColorMark {
  type: "backgroundColor";
  attrs: {
    color: string;
  };
}

export interface LinkMark {
  type: "link";
  attrs: {
    href: string;
    openInNewTab?: boolean;
  };
}

export interface FontSizeMark {
  type: "fontSize";
  attrs: {
    size: number;
  };
}

export interface FontFamilyMark {
  type: "fontFamily";
  attrs: {
    family: string;
  };
}

export type DocumentMark =
  | BoldMark
  | ItalicMark
  | UnderlineMark
  | StrikeMark
  | TextColorMark
  | BackgroundColorMark
  | LinkMark
  | FontSizeMark
  | FontFamilyMark;
