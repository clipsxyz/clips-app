declare module 'html2canvas' {
  interface Options {
    useCORS?: boolean;
    allowTaint?: boolean;
    scale?: number;
    backgroundColor?: string | null;
    logging?: boolean;
    width?: number;
    height?: number;
    windowWidth?: number;
    windowHeight?: number;
  }
  function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
