import { useEffect, useState } from 'react';
import { buyCheckpoint, buyGun, equipGun, getRunInventory, type RunInventory } from '../lib/trollApi';
import { WEAPONS } from '../game/weapons';

interface GameStoreProps {
  onBack: () => void;
}

export function GameStore({ onBack }: GameStoreProps) {
  const [inventory, setInventory] = useState<RunInventory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getRunInventory()
      .then((value) => {
        if (active) setInventory(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the game store.');
      });
    return () => {
      active = false;
    };
  }, []);

  const purchase = async (action: () => Promise<RunInventory>) => {
    setBusy(true);
    setError('');
    try {
      setInventory(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-stone-800 bg-stone-900/80 p-6">
      <button type="button" onClick={onBack} className="mb-5 text-sm text-stone-300 hover:text-amber-300">
        ← Back to MaiTroll Run
      </button>
      <h1 className="font-serif text-3xl font-bold text-stone-50">MaiTroll Run Store</h1>
      {inventory && (
        <p className="mt-2 text-sm text-amber-300">
          {inventory.trollCoins.toLocaleString()} Troll Coins · {inventory.checkpoints} checkpoints
        </p>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}

      <div className="mt-6 rounded-xl border border-cyan-900 bg-cyan-950/30 p-5">
        <h2 className="text-xl font-semibold text-cyan-100">Checkpoints</h2>
        <p className="mt-2 text-sm text-stone-300">
          Your account starts with 20 checkpoints. Spend one after a run ends to restart at your last completed level.
          Additional checkpoints cost 5 Troll Coins each and stay on your account.
        </p>
        <button
          type="button"
          disabled={!inventory || busy}
          onClick={() => void purchase(buyCheckpoint)}
          className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-stone-950 disabled:opacity-50"
        >
          Buy 1 checkpoint · 5 coins
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-stone-100">Weapons</h2>
        <p className="mt-1 text-sm text-stone-400">Owned weapons and equipment are saved to your MaiTroll account. Each shot costs 1 Troll Coin.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {WEAPONS.map((weapon) => {
            const owned = inventory?.ownedGuns.includes(weapon.key) ?? false;
            const equipped = inventory?.equippedGun === weapon.key;
            return (
              <article key={weapon.key} className="rounded-xl border border-stone-700 bg-stone-950 p-4">
                <p className="text-xs uppercase tracking-widest text-amber-400">{weapon.page}</p>
                <h3 className="mt-1 text-lg font-bold text-stone-100">{weapon.name}</h3>
                <p className="mt-1 min-h-10 text-sm text-stone-400">{weapon.description}</p>
                <p className="mt-3 text-sm text-amber-300">{weapon.price.toLocaleString()} Troll Coins</p>
                <button
                  type="button"
                  disabled={!inventory || busy || equipped}
                  onClick={() => void purchase(() => (owned
                    ? equipGun(weapon.key)
                    : buyGun(weapon.key)))}
                  className="mt-3 w-full rounded-lg border border-stone-600 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-amber-400 disabled:opacity-50"
                >
                  {equipped ? 'Equipped' : owned ? 'Equip' : 'Purchase'}
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <p className="mt-6 rounded-lg bg-stone-950 p-3 text-xs leading-relaxed text-stone-400">
        Cheating or exploiting the game may result in account restrictions and coin deductions. Weapons only destroy hazards;
        pits still require jumping.
      </p>
    </section>
  );
}
