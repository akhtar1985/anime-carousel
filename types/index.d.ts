// Type definitions for anime-carousel
// Project: https://github.com/akhtar1985/anime-carousel

export type Mode =
  | 'slide'
  | 'fade'
  | 'coverflow'
  | 'cards'
  | 'wheel'
  | 'helix'
  | 'flip'
  | 'fold'
  | 'cube'
  | 'zoom'
  | 'marquee'
  | 'kenburns'
  | 'staggered';

export type DotsType = 'bullets' | 'fraction' | 'progress';
export type LazyLoadMode = false | 'ondemand' | 'progressive';
export type SlidesToShow = number | 'auto';

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
}

export interface FadeEffect {
  scale?: number;
  blur?: number;
}

export interface CoverflowEffect {
  rotate?: number;
  depth?: number;
  scale?: number;
  modifier?: number;
  opacity?: number;
  offset?: number;
  tilt?: number;
  lift?: number;
  blur?: number;
  visible?: number;
}

export interface CardsEffect {
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
  maxStack?: number;
  opacity?: number;
}

export interface WheelEffect {
  radius?: number;
  angle?: number;
  scale?: number;
  opacity?: number;
  offset?: number;
  depth?: number;
  tilt?: number;
  blur?: number;
  visible?: number;
}

export interface HelixEffect {
  radius?: number;
  rotate?: number;
  rise?: number;
  scale?: number;
  opacity?: number;
  offset?: number;
  depth?: number;
  tilt?: number;
  blur?: number;
  visible?: number;
}

export interface FlipEffect {
  rotate?: number;
  depth?: number;
  opacity?: number;
}

export interface FoldEffect {
  rotate?: number;
  depth?: number;
  opacity?: number;
}

export interface CubeEffect {
  rotate?: number;
  depth?: number;
}

export interface ZoomEffect {
  scale?: number;
  exitScale?: number;
  depth?: number;
  blur?: number;
  opacity?: number;
}

export interface KenBurnsEffect {
  targets?: string;
  from?: number;
  to?: number;
  duration?: number;
  alternate?: boolean;
  panX?: number;
  panY?: number;
}

export interface StaggerEffect {
  targets?: string | null | ((slide: HTMLElement) => Element[]);
  each?: number;
  duration?: number;
  distance?: number;
  ease?: string;
  from?: string | number;
}

export interface MarqueeEffect {
  speed?: number;
  direction?: 'normal' | 'reverse';
  pauseOnHover?: boolean;
  duplicated?: boolean;
}

export interface AriaLabels {
  region?: string;
  prev?: string;
  next?: string;
  dots?: string;
  slide?: (index: number, total: number) => string;
}

export interface ResponsiveEntry {
  breakpoint: number;
  settings?: AnimeCarouselOptions;
}

export interface CarouselDetail {
  type: string;
  index: number;
  previousIndex: number;
  slide: HTMLElement | null;
  slides: HTMLElement[];
  direction: 'next' | 'prev' | 'none';
  total: number;
  instance: AnimeCarousel;
}

export interface AnimeCarouselOptions {
  /* mode & structure */
  mode?: Mode;
  initialSlide?: number;
  effect?: Mode;

  /* layout */
  slidesToShow?: SlidesToShow;
  slidesPerView?: SlidesToShow;
  slidesToScroll?: number;
  spaceBetween?: number;
  infinite?: boolean;
  loop?: boolean;
  centerMode?: boolean;
  centeredSlides?: boolean;
  centerPadding?: string | number;
  vertical?: boolean;
  rtl?: boolean;
  adaptiveHeight?: boolean;
  watchOverflow?: boolean;

  /* motion */
  speed?: number;
  easing?: string;
  spring?: boolean;
  springConfig?: SpringConfig;
  reducedMotion?: 'respect' | 'ignore';
  perspective?: number;

  /* autoplay */
  autoplay?: boolean | { delay?: number; pauseOnMouseEnter?: boolean; disableOnInteraction?: boolean };
  autoplaySpeed?: number;
  delay?: number;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  pauseOnDotsHover?: boolean;
  pauseOnInteraction?: boolean;
  stopOnLastSlide?: boolean;

  /* navigation */
  arrows?: boolean | object;
  navigation?: boolean | object;
  prevArrow?: string | HTMLElement | null;
  nextArrow?: string | HTMLElement | null;
  hideOnEdges?: boolean;
  dots?: boolean | { type?: DotsType; dynamicBullets?: boolean; clickable?: boolean };
  pagination?: boolean | { type?: DotsType; dynamicBullets?: boolean; clickable?: boolean };
  dotsType?: DotsType;
  dynamicBullets?: boolean;
  customPaging?: ((page: number, dot: HTMLElement) => string | HTMLElement) | null;
  dotsPerPage?: boolean;
  paginationClickable?: boolean;

  /* interaction */
  draggable?: boolean;
  swipe?: boolean;
  swipeToSlide?: boolean;
  touchMove?: boolean;
  touchThreshold?: number;
  dragThreshold?: number;
  dragResistance?: number;
  mousewheel?: boolean;
  keyboard?: boolean;
  focusable?: boolean;
  focusOnSelect?: boolean;
  emitEvents?: boolean;

  /* media */
  lazyLoad?: LazyLoadMode;
  lazyLoadSelector?: string;

  /* responsive & sync */
  responsive?: ResponsiveEntry[] | Record<string | number, AnimeCarouselOptions> | null;
  breakpoints?: ResponsiveEntry[] | Record<string | number, AnimeCarouselOptions>;
  breakpointsBase?: 'window' | 'container';
  asNavFor?: string | HTMLElement | AnimeCarousel | Array<string | HTMLElement | AnimeCarousel> | null;
  controller?: string | AnimeCarousel | null;
  syncClick?: boolean;

  /* effects */
  fadeEffect?: FadeEffect;
  coverflowEffect?: CoverflowEffect;
  cardsEffect?: CardsEffect;
  wheelEffect?: WheelEffect;
  helixEffect?: HelixEffect;
  flipEffect?: FlipEffect;
  foldEffect?: FoldEffect;
  cubeEffect?: CubeEffect;
  zoomEffect?: ZoomEffect;
  kenBurns?: KenBurnsEffect;
  kenburns?: KenBurnsEffect;
  staggerEffect?: StaggerEffect;
  marquee?: MarqueeEffect;

  /* a11y */
  a11y?: boolean;
  announce?: boolean;
  ariaLabels?: AriaLabels;

  /* callbacks */
  onInit?: (detail: CarouselDetail) => void;
  onBeforeChange?: (detail: CarouselDetail) => void;
  onSlideChange?: (detail: CarouselDetail) => void;
  onAfterChange?: (detail: CarouselDetail) => void;
  onTransitionEnd?: (detail: CarouselDetail) => void;
  onBreakpoint?: (detail: { breakpoint: number | null; settings: object; size: number; index: number }) => void;
  onDestroy?: (detail: { instance: AnimeCarousel }) => void;
  onDragStart?: (detail: { delta: number; index: number }) => void;
  onDragMove?: (detail: { delta: number; progress: number; index: number }) => void;
  onDragEnd?: (detail: { delta: number; velocity: number; index: number }) => void;
  onAutoplayStart?: (detail: { index: number }) => void;
  onAutoplayStop?: (detail: { index: number }) => void;
  onReachStart?: (detail: CarouselDetail) => void;
  onReachEnd?: (detail: CarouselDetail) => void;

  [key: string]: unknown;
}

export interface NavigationController {
  mount(): void;
  update(index?: number): void;
  destroy(): void;
}

export interface DragController {
  mount(): void;
  updateCursor(): void;
  destroy(): void;
}

export interface EffectDescriptor {
  limit(options: AnimeCarouselOptions): number;
  stacked?: boolean;
  perspective?: boolean;
  apply(state: Record<string, unknown>, context: Record<string, unknown>): void;
}

export declare class AnimeCarousel {
  constructor(element: string | Element, options?: AnimeCarouselOptions);

  static version: string;
  static autoInit(scope?: Document | Element): AnimeCarousel[];
  static create(element: string | Element, options?: AnimeCarouselOptions): AnimeCarousel;

  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
  readonly track: HTMLElement;
  readonly options: AnimeCarouselOptions;
  readonly version: string;
  readonly id: string;
  readonly count: number;
  readonly activeIndex: number;
  readonly destroyed: boolean;

  slides: HTMLElement[];
  progress: number;

  next(): this;
  prev(): this;
  goTo(index: number, instant?: boolean | { instant?: boolean }): this;
  play(): this;
  pause(): this;
  toggleAutoplay(): this;
  setMode(mode: Mode, extra?: AnimeCarouselOptions): this;
  setOption<K extends keyof AnimeCarouselOptions>(key: K, value: AnimeCarouselOptions[K]): this;
  addSlide(content: string | HTMLElement, index?: number): HTMLElement;
  removeSlide(index: number): this;
  refresh(options?: { silent?: boolean }): this;
  update(): this;
  sync(target: string | HTMLElement | AnimeCarousel | Array<string | HTMLElement | AnimeCarousel>, options?: { bidirectional?: boolean }): this;
  destroy(): void;

  /* controllers, exposed for advanced use */
  nav: NavigationController;
  autoplay: { start(): void; pause(reason?: string): void; isRunning: boolean };
  drag: DragController;
  marquee: { play(): void; pause(): void; toggle(): void; restart(): void };
  lazy: { load(): void; scan(): void };
}

export declare const VERSION: string;
export declare const MODES: Mode[];
export declare const DEFAULT_OPTIONS: AnimeCarouselOptions;
export declare const EFFECTS: Record<Exclude<Mode, 'marquee'>, EffectDescriptor>;

export declare function create(element: string | Element, options?: AnimeCarouselOptions): AnimeCarousel;
export declare function autoInit(scope?: Document | Element): AnimeCarousel[];
export declare function getInstance(id: string): AnimeCarousel | null;
export declare function resolveInstances(
  reference: string | Element | AnimeCarousel | Array<string | Element | AnimeCarousel>,
  self?: AnimeCarousel,
): AnimeCarousel[];
export declare function attachSync(source: AnimeCarousel, targets?: AnimeCarousel[]): void;

export default AnimeCarousel;
