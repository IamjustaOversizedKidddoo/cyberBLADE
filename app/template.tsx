/**
 * Re-mounts on every navigation, so each new page arrives with one cyan scan line sweeping the screen.
 * Pure CSS (globals.css `.route-scan`): no JavaScript, never blocks clicks, off with reduced motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div data-route-scan aria-hidden="true" className="route-scan" />
      {children}
    </>
  );
}
