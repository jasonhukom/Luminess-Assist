import { describe, expect, it } from 'vitest';
import {
  buildAiForkCustomizePrompt,
  createDefaultBotCustomization,
  getGitHubManifestRawUrl,
  hexToRgba,
  mergeBotCustomization,
  parseGitHubRepoSlug,
} from './botCustomization';

describe('botCustomization', () => {
  it('parses GitHub repo slugs from URLs and owner/repo syntax', () => {
    expect(parseGitHubRepoSlug('jasonhukom/Luminess-Assist')).toBe('jasonhukom/Luminess-Assist');
    expect(parseGitHubRepoSlug('https://github.com/alice/Luminess-Assist.git')).toBe(
      'alice/Luminess-Assist'
    );
    expect(parseGitHubRepoSlug('https://github.com/bob/my-bot/tree/main')).toBe('bob/my-bot');
    expect(parseGitHubRepoSlug('not a repo')).toBeNull();
  });

  it('builds raw GitHub manifest URLs for forked repos', () => {
    expect(getGitHubManifestRawUrl('https://github.com/alice/Luminess-Assist', 'custom-dev')).toBe(
      'https://raw.githubusercontent.com/alice/Luminess-Assist/custom-dev/luminess.bot.json'
    );
  });

  it('merges platform profile and anger customization safely with clamping', () => {
    const base = createDefaultBotCustomization();
    const merged = mergeBotCustomization(base, {
      botName: 'Vortex',
      githubRepo: 'https://github.com/alice/Luminess-Assist',
      appearance: {
        ...base.appearance,
        idleColor: '#f43f5e',
        angerColor: '#fb923c',
        accessory: 'crown',
        scale: 5,
      },
      angerSettings: {
        ...base.angerSettings,
        wallImpactSensitivity: 10,
        hostileKeywords: ['slow', 'broken'],
        triggers: {
          wallImpact: false,
          hostileWords: true,
          rapidShake: true,
          repeatedInterruptions: true,
        },
      },
    } as Record<string, unknown>);

    expect(merged.botName).toBe('Vortex');
    expect(merged.repo).toBe('alice/Luminess-Assist');
    expect(merged.appearance.idleColor).toBe('#f43f5e');
    expect(merged.appearance.angerColor).toBe('#fb923c');
    expect(merged.appearance.accessory).toBe('crown');
    expect(merged.appearance.scale).toBe(1.5);
    expect(merged.angerSettings.wallImpactSensitivity).toBe(3.5);
    expect(merged.angerSettings.triggers.wallImpact).toBe(false);
    expect(merged.angerSettings.triggers.repeatedInterruptions).toBe(true);
    expect(merged.angerSettings.hostileKeywords).toEqual(['slow', 'broken']);
  });

  it('converts hex colors to rgba strings and generates fork AI prompts', () => {
    expect(hexToRgba('#f97316', 0.5)).toBe('rgba(249, 115, 22, 0.5)');
    const manifest = createDefaultBotCustomization();
    manifest.repo = 'alice/Luminess-Assist';
    const prompt = buildAiForkCustomizePrompt(manifest);
    expect(prompt).toContain('alice/Luminess-Assist');
    expect(prompt).toContain('luminess.bot.json');
  });
});
