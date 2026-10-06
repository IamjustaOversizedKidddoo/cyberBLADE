/** Original plain-language agreement every operator accepts before learning (spec §4.3, §13). */
export function EthicalUseAgreement() {
  return (
    <div className="space-y-4 text-muted">
      <p>
        This platform teaches real attack and defence techniques. That knowledge is powerful, so using it comes with
        rules. By starting, you agree to all of them.
      </p>
      <h3 className="text-lg text-ink">1. Where you may practise</h3>
      <p>
        Only inside this platform&apos;s simulated labs, on computers and accounts you own, or on systems whose owner
        has given you clear written permission to test.
      </p>
      <h3 className="text-lg text-ink">2. What you must never do</h3>
      <p>
        Never use anything you learn here against real systems, networks, websites, accounts or people without that
        permission — not to test, not to &quot;just look&quot;, not as a joke.
      </p>
      <h3 className="text-lg text-ink">3. The law</h3>
      <p>
        In India, accessing or damaging a computer system without permission is covered by the Information Technology
        Act, 2000 — for example section 43 (compensation for damage to computer systems) and section 66 (computer
        related offences, which can lead to imprisonment and fines). Most other countries have similar laws. This is a
        summary, not legal advice.
      </p>
      <h3 className="text-lg text-ink">4. If you break these rules</h3>
      <p>You lose access to the platform and any certificates it issued to you.</p>
    </div>
  );
}
