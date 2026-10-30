import React from 'react';
import BattleArenaRoomPreviewPhone from './BattleArenaRoomPreviewPhone';

const sampleBattle = {
  id: 'b2',
  challenger: 'VoidTroll',
  opponent: 'FrostNomad',
  scoreC: 9200,
  scoreO: 8750,
  viewers: 680,
  mode: 'Challenge',
  artC: 'art-green',
  artO: 'art-purple',
};

export default function BattleArenaPreviewPhone() {
  return (
    <BattleArenaRoomPreviewPhone
      battle={sampleBattle as any}
      onClose={() => window.history.back()}
    />
  );
}
