/**
 * Matinee design tokens.
 * Generated from the same source as the Figma variables in the "Matinee" file
 * (https://www.figma.com/design/76VKO0l9gGt5YMNYtH8yvM).
 * Token names and values match the Figma variables exactly. Do not edit by hand:
 * change the variable in Figma and regenerate this file so the two never drift.
 *
 * Units: space, radius, size, type sizes and line heights are dp/sp numbers.
 * Durations are milliseconds. Easing values are cubic-bezier strings.
 */

/** Figma collection: Primitives (mode: Value) */
export const primitives = {
  'neutral/0': "#FFFFFF",
  'neutral/50': "#F6F5F2",
  'neutral/200': "#DEDDD8",
  'neutral/300': "#D6D5D0",
  'neutral/400': "#A8A8A3",
  'neutral/500': "#8A8A86",
  'neutral/600': "#77777A",
  'neutral/700': "#5C5C58",
  'neutral/800': "#333338",
  'neutral/850': "#222225",
  'neutral/900': "#18181A",
  'neutral/950': "#131314",
  'neutral/1000': "#0E0E0F",

  'green/300': "#5FD08A",
  'green/700': "#1B7A43",
  'amber/300': "#F2B441",
  'amber/700': "#8F5B00",
  'red/300': "#FF6961",
  'red/700': "#C4302B",
  'blue/300': "#74A9FF",
  'blue/700': "#1D5FC2",
  'orange/400': "#FF5B2E",
  'orange/700': "#C93A0C",
  'orange/950': "#140700",

  'black/0': "rgba(0, 0, 0, 0)",
  'black/8': "rgba(0, 0, 0, 0.08)",
  'black/10': "rgba(0, 0, 0, 0.1)",
  'black/16': "rgba(0, 0, 0, 0.16)",
  'black/60': "rgba(0, 0, 0, 0.6)",

  'fade/light': "rgba(246, 245, 242, 0)",
  'fade/dark': "rgba(14, 14, 15, 0)",

  'space/0': 0,
  'space/1': 4,
  'space/2': 8,
  'space/3': 12,
  'space/4': 16,
  'space/5': 20,
  'space/6': 24,
  'space/8': 32,
  'space/10': 40,
  'space/12': 48,
  'space/16': 64,

  'radius/sm': 4,
  'radius/md': 8,
  'radius/lg': 16,
  'radius/full': 999,

  'size/touch-min': 48,
  'size/button-height': 48,
  'size/input-height': 48,
  'size/chip-height': 32,
  'size/icon-sm': 16,
  'size/icon-md': 20,
  'size/icon-lg': 24,
  'size/seat': 36,
  'size/seat-gap': 8,
  'size/nav-height': 56,
  'size/poster-width': 128,
  'size/poster-height': 192,
  'size/thumb-width': 64,
  'size/thumb-height': 96,

  'border-width/default': 1,
  'border-width/strong': 2,

  'type/numeral/family': "Newsreader",
  'type/numeral/size': 64,
  'type/numeral/line-height': 72,
  'type/numeral/weight': 400,
  'type/display/family': "Newsreader",
  'type/display/size': 32,
  'type/display/line-height': 40,
  'type/display/weight': 400,
  'type/title-lg/family': "Newsreader",
  'type/title-lg/size': 24,
  'type/title-lg/line-height': 32,
  'type/title-lg/weight': 400,
  'type/title/family': "Inter",
  'type/title/size': 20,
  'type/title/line-height': 28,
  'type/title/weight': 600,
  'type/body-lg/family': "Inter",
  'type/body-lg/size': 16,
  'type/body-lg/line-height': 24,
  'type/body-lg/weight': 400,
  'type/body/family': "Inter",
  'type/body/size': 14,
  'type/body/line-height': 20,
  'type/body/weight': 400,
  'type/label-lg/family': "Inter",
  'type/label-lg/size': 16,
  'type/label-lg/line-height': 24,
  'type/label-lg/weight': 600,
  'type/label/family': "Inter",
  'type/label/size': 14,
  'type/label/line-height': 20,
  'type/label/weight': 500,
  'type/caption/family': "Inter",
  'type/caption/size': 12,
  'type/caption/line-height': 16,
  'type/caption/weight': 500,

  'elevation/1/y': 1,
  'elevation/1/blur': 3,
  'elevation/2/y': 4,
  'elevation/2/blur': 12,
  'elevation/3/y': 12,
  'elevation/3/blur': 32,

  'duration/fast': 150,
  'duration/base': 250,
  'duration/slow': 350,
  'duration/celebrate': 600,

  'easing/standard': "cubic-bezier(0.2, 0, 0, 1)",
  'easing/enter': "cubic-bezier(0, 0, 0, 1)",
  'easing/exit': "cubic-bezier(0.3, 0, 1, 1)",
} as const;

export type PrimitiveToken = keyof typeof primitives;

/** Figma collection: Semantic (modes: Light, Dark). Every value aliases a primitive. */
export const semantic = {
  light: {
    'surface/default': primitives['neutral/50'],
    'surface/raised': primitives['neutral/0'],
    'surface/overlay': primitives['neutral/0'],
    'surface/scrim': primitives['black/60'],
    'surface/default-clear': primitives['fade/light'],
    'surface/scrim-clear': primitives['black/0'],
    'border/default': primitives['neutral/200'],
    'border/strong': primitives['neutral/500'],
    'text/primary': primitives['neutral/950'],
    'text/secondary': primitives['neutral/700'],
    'text/disabled': primitives['neutral/500'],
    'text/on-primary': primitives['neutral/0'],
    'text/on-secondary': primitives['neutral/950'],
    'text/on-urgent': primitives['neutral/0'],
    'primary/default': primitives['neutral/950'],
    'primary/pressed': primitives['neutral/800'],
    'primary/disabled': primitives['neutral/300'],
    'secondary/default': primitives['neutral/0'],
    'secondary/pressed': primitives['neutral/200'],
    'secondary/border': primitives['neutral/500'],
    'status/success': primitives['green/700'],
    'status/warning': primitives['amber/700'],
    'status/error': primitives['red/700'],
    'status/info': primitives['blue/700'],
    'urgent/default': primitives['orange/700'],
    'seat/available': primitives['neutral/700'],
    'seat/selected': primitives['neutral/950'],
    'seat/selected-mark': primitives['neutral/0'],
    'seat/held': primitives['neutral/500'],
    'seat/sold': primitives['neutral/300'],
    'seat/sold-mark': primitives['neutral/500'],
    'seat/accessible': primitives['blue/700'],
    'qr/background': primitives['neutral/0'],
    'qr/foreground': primitives['neutral/1000'],
    'skeleton/base': primitives['neutral/200'],
    'skeleton/highlight': primitives['neutral/50'],
    'shadow/1': primitives['black/8'],
    'shadow/2': primitives['black/10'],
    'shadow/3': primitives['black/16'],
  },
  dark: {
    'surface/default': primitives['neutral/1000'],
    'surface/raised': primitives['neutral/900'],
    'surface/overlay': primitives['neutral/850'],
    'surface/scrim': primitives['black/60'],
    'surface/default-clear': primitives['fade/dark'],
    'surface/scrim-clear': primitives['black/0'],
    'border/default': primitives['neutral/800'],
    'border/strong': primitives['neutral/600'],
    'text/primary': primitives['neutral/50'],
    'text/secondary': primitives['neutral/400'],
    'text/disabled': primitives['neutral/600'],
    'text/on-primary': primitives['neutral/1000'],
    'text/on-secondary': primitives['neutral/50'],
    'text/on-urgent': primitives['orange/950'],
    'primary/default': primitives['neutral/50'],
    'primary/pressed': primitives['neutral/200'],
    'primary/disabled': primitives['neutral/800'],
    'secondary/default': primitives['neutral/900'],
    'secondary/pressed': primitives['neutral/850'],
    'secondary/border': primitives['neutral/600'],
    'status/success': primitives['green/300'],
    'status/warning': primitives['amber/300'],
    'status/error': primitives['red/300'],
    'status/info': primitives['blue/300'],
    'urgent/default': primitives['orange/400'],
    'seat/available': primitives['neutral/400'],
    'seat/selected': primitives['neutral/50'],
    'seat/selected-mark': primitives['neutral/1000'],
    'seat/held': primitives['neutral/600'],
    'seat/sold': primitives['neutral/800'],
    'seat/sold-mark': primitives['neutral/600'],
    'seat/accessible': primitives['blue/300'],
    'qr/background': primitives['neutral/0'],
    'qr/foreground': primitives['neutral/1000'],
    'skeleton/base': primitives['neutral/900'],
    'skeleton/highlight': primitives['neutral/850'],
    'shadow/1': primitives['black/0'],
    'shadow/2': primitives['black/0'],
    'shadow/3': primitives['black/0'],
  },
} as const;

export type ThemeMode = keyof typeof semantic;
export type SemanticToken = keyof typeof semantic.light;

/**
 * Figma text styles type/*. fontFamily is the Expo Google Fonts face name for the
 * family and weight held in the matching type/<step>/family and /weight primitives.
 */
export const textStyles = {
  'type/numeral': {
    fontFamily: 'Newsreader_400Regular',
    fontSize: primitives['type/numeral/size'],
    lineHeight: primitives['type/numeral/line-height'],
    fontWeight: primitives['type/numeral/weight'],
  },
  'type/display': {
    fontFamily: 'Newsreader_400Regular',
    fontSize: primitives['type/display/size'],
    lineHeight: primitives['type/display/line-height'],
    fontWeight: primitives['type/display/weight'],
  },
  'type/title-lg': {
    fontFamily: 'Newsreader_400Regular',
    fontSize: primitives['type/title-lg/size'],
    lineHeight: primitives['type/title-lg/line-height'],
    fontWeight: primitives['type/title-lg/weight'],
  },
  'type/title': {
    fontFamily: 'Inter_600SemiBold',
    fontSize: primitives['type/title/size'],
    lineHeight: primitives['type/title/line-height'],
    fontWeight: primitives['type/title/weight'],
  },
  'type/body-lg': {
    fontFamily: 'Inter_400Regular',
    fontSize: primitives['type/body-lg/size'],
    lineHeight: primitives['type/body-lg/line-height'],
    fontWeight: primitives['type/body-lg/weight'],
  },
  'type/body': {
    fontFamily: 'Inter_400Regular',
    fontSize: primitives['type/body/size'],
    lineHeight: primitives['type/body/line-height'],
    fontWeight: primitives['type/body/weight'],
  },
  'type/label-lg': {
    fontFamily: 'Inter_600SemiBold',
    fontSize: primitives['type/label-lg/size'],
    lineHeight: primitives['type/label-lg/line-height'],
    fontWeight: primitives['type/label-lg/weight'],
  },
  'type/label': {
    fontFamily: 'Inter_500Medium',
    fontSize: primitives['type/label/size'],
    lineHeight: primitives['type/label/line-height'],
    fontWeight: primitives['type/label/weight'],
  },
  'type/caption': {
    fontFamily: 'Inter_500Medium',
    fontSize: primitives['type/caption/size'],
    lineHeight: primitives['type/caption/line-height'],
    fontWeight: primitives['type/caption/weight'],
  },
} as const;

export type TextStyleToken = keyof typeof textStyles;

/** Figma effect styles elevation/1 to elevation/3. Shadow colour switches by mode; dark shows height with surface and border instead. */
export const elevation = {
  light: {
    'elevation/1': {
      color: semantic.light['shadow/1'],
      offsetX: 0,
      offsetY: primitives['elevation/1/y'],
      blur: primitives['elevation/1/blur'],
      spread: 0,
    },
    'elevation/2': {
      color: semantic.light['shadow/2'],
      offsetX: 0,
      offsetY: primitives['elevation/2/y'],
      blur: primitives['elevation/2/blur'],
      spread: 0,
    },
    'elevation/3': {
      color: semantic.light['shadow/3'],
      offsetX: 0,
      offsetY: primitives['elevation/3/y'],
      blur: primitives['elevation/3/blur'],
      spread: 0,
    },
  },
  dark: {
    'elevation/1': {
      color: semantic.dark['shadow/1'],
      offsetX: 0,
      offsetY: primitives['elevation/1/y'],
      blur: primitives['elevation/1/blur'],
      spread: 0,
    },
    'elevation/2': {
      color: semantic.dark['shadow/2'],
      offsetX: 0,
      offsetY: primitives['elevation/2/y'],
      blur: primitives['elevation/2/blur'],
      spread: 0,
    },
    'elevation/3': {
      color: semantic.dark['shadow/3'],
      offsetX: 0,
      offsetY: primitives['elevation/3/y'],
      blur: primitives['elevation/3/blur'],
      spread: 0,
    },
  },
} as const;

export const tokens = { primitives, semantic, textStyles, elevation } as const;
export default tokens;
