import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'MOTHERLOAD\n\nscaffold ok', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#e0e0e0',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
