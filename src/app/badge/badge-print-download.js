// Deliberate exception to the Toolcraft product boundary (user request:
// the print pack "packaged in a zip"). The runtime only downloads its own
// single-image exports, so the ZIP is saved here with an object URL.
// See docs/toolcraft/agent-worklog.md (pass-011).

/** Starts a browser download of `blob` as `fileName`. */
export function downloadBadgeFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
