// The package ships no types — minimal declaration for the one API we use.
// https://github.com/renzhezhilu/gifsicle-wasm-browser
declare module "gifsicle-wasm-browser" {
  type GifsicleInput = {
    /** A File/Blob, URL string, or base64 data URL. */
    file: File | Blob | string
    /** The filename the command refers to (e.g. "in.gif"). */
    name: string
  }

  const gifsicle: {
    /** Runs gifsicle in a worker; files written to /out/ are returned. */
    run(options: { input: GifsicleInput[]; command: string[] }): Promise<File[]>
  }

  export default gifsicle
}
