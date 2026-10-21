import { emptyAttachments } from '../../../core/models/loadout.model';
import { defaultColorState } from '../../../data/channels.data';
import { posterRows } from './poster-content';

describe('posterRows', () => {
  it('lists nothing for an untouched loadout', () => {
    expect(
      posterRows({ attachments: emptyAttachments(), colorState: defaultColorState() }),
    ).toEqual({
      fields: [],
      colors: [],
    });
  });

  it('lists only filled-in attachments and picked colors, in form order', () => {
    const colorState = defaultColorState();
    colorState.en1 = { palette: 'Tenno', row: 2, col: 1, hex: '#20a0e0', label: 'Tenno B3' };
    colorState.primary = { palette: 'Fire', row: 0, col: 0, hex: '#c02020', label: 'Fire A1' };
    const attachments = { ...emptyAttachments(), syandana: ' Volca ', helmet: 'Prime' };

    const { fields, colors } = posterRows({ attachments, colorState });

    expect(fields).toEqual([
      { label: 'HELMET', value: 'Prime' },
      { label: 'SYANDANA', value: 'Volca' },
    ]);
    expect(colors.map((c) => c.label)).toEqual(['PRIMARY', 'ENERGY I']);
    expect(colors[0]).toEqual({ label: 'PRIMARY', value: 'Fire A1', hex: '#c02020' });
  });
});
