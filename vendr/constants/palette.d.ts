export type ThemeTokens = {
  canvas: string; surface: string; surface2: string; line: string; lineStrong: string;
  glass: string; heroBg: string;
  ink: string; ink2: string; ink3: string; ink4: string; onPrimary: string;
  primary: string; primaryPressed: string; primaryInk: string; primarySoft: string; primaryBorder: string;
  gold: string; goldInk: string; goldSoft: string;
  success: string; successInk: string; successSoft: string;
  danger: string; dangerInk: string; dangerSoft: string;
  info: string; infoInk: string; infoSoft: string;
  overlay: string;
};
export declare const light: ThemeTokens;
export declare const dark: ThemeTokens;
export declare const palette: ThemeTokens;
export declare const CSS_VAR_TOKENS: (keyof ThemeTokens)[];
export declare function cssVars(theme: ThemeTokens): Record<string, string>;
