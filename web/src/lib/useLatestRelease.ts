import { useState, useEffect } from 'react';

export interface ReleaseAsset {
  name: string;
  title: string;
  tag: string;
  size: string;
  type: string;
  color: string;
  btnColor: string;
  url: string;
  desc: string;
}

export interface LatestReleaseData {
  version: string;
  tagName: string;
  publishedAt: string;
  htmlUrl: string;
  exeAsset: ReleaseAsset;
  msiAsset: ReleaseAsset;
  assets: ReleaseAsset[];
  body: string;
  isLoading: boolean;
}

const DEFAULT_VERSION = '1.1.2';
const DEFAULT_TAG = `v${DEFAULT_VERSION}`;
const REPO = 'jasonhukom/Luminess-Assist';

function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '2.1 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export function useLatestRelease(): LatestReleaseData {
  const [data, setData] = useState<LatestReleaseData>(() => {
    const defaultExe: ReleaseAsset = {
      name: `Luminess.Assist_${DEFAULT_VERSION}_x64-setup.exe`,
      title: 'Windows NSIS Setup (.exe)',
      tag: 'Recommended for Most Users',
      size: '2.11 MB',
      type: 'Standalone Self-Extractor',
      color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300',
      btnColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.4)]',
      url: `https://github.com/${REPO}/releases/download/${DEFAULT_TAG}/Luminess.Assist_${DEFAULT_VERSION}_x64-setup.exe`,
      desc: 'Standard setup wizard with automatic desktop and start menu shortcut generation.',
    };

    const defaultMsi: ReleaseAsset = {
      name: `Luminess.Assist_${DEFAULT_VERSION}_x64_en-US.msi`,
      title: 'Windows Installer Package (.msi)',
      tag: 'Enterprise & IT Admin',
      size: '3.12 MB',
      type: 'Wix MSI Package',
      color: 'border-purple-500/30 bg-purple-950/20 text-purple-300',
      btnColor: 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]',
      url: `https://github.com/${REPO}/releases/download/${DEFAULT_TAG}/Luminess.Assist_${DEFAULT_VERSION}_x64_en-US.msi`,
      desc: 'Windows Installer package supporting group policy deployment and silent enterprise rollouts.',
    };

    return {
      version: DEFAULT_VERSION,
      tagName: DEFAULT_TAG,
      publishedAt: 'Latest',
      htmlUrl: `https://github.com/${REPO}/releases`,
      exeAsset: defaultExe,
      msiAsset: defaultMsi,
      assets: [defaultExe, defaultMsi],
      body: '',
      isLoading: true,
    };
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchLatestRelease() {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!res.ok) {
          if (isMounted) setData((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const json = await res.json();
        const rawTag: string = json.tag_name || DEFAULT_TAG;
        const cleanVersion = rawTag.replace(/^v/, '').trim();
        const publishedDate = json.published_at
          ? new Date(json.published_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : 'Latest';

        const rawAssets: Array<{ name: string; browser_download_url: string; size: number }> =
          json.assets || [];

        // Find exe asset (case-insensitive or fallback to standard name)
        const foundExe = rawAssets.find(
          (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('.sig')
        );
        const exeUrl =
          foundExe?.browser_download_url ||
          `https://github.com/${REPO}/releases/download/${rawTag}/Luminess.Assist_${cleanVersion}_x64-setup.exe`;
        const exeName = foundExe?.name || `Luminess.Assist_${cleanVersion}_x64-setup.exe`;
        const exeSize = foundExe ? formatFileSize(foundExe.size) : '2.11 MB';

        // Find msi asset
        const foundMsi = rawAssets.find(
          (a) => a.name.toLowerCase().endsWith('.msi') && !a.name.toLowerCase().includes('.sig')
        );
        const msiUrl =
          foundMsi?.browser_download_url ||
          `https://github.com/${REPO}/releases/download/${rawTag}/Luminess.Assist_${cleanVersion}_x64_en-US.msi`;
        const msiName = foundMsi?.name || `Luminess.Assist_${cleanVersion}_x64_en-US.msi`;
        const msiSize = foundMsi ? formatFileSize(foundMsi.size) : '3.12 MB';

        const exeAsset: ReleaseAsset = {
          name: exeName,
          title: 'Windows NSIS Setup (.exe)',
          tag: 'Recommended for Most Users',
          size: exeSize,
          type: 'Standalone Self-Extractor',
          color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300',
          btnColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.4)]',
          url: exeUrl,
          desc: 'Standard setup wizard with automatic desktop and start menu shortcut generation.',
        };

        const msiAsset: ReleaseAsset = {
          name: msiName,
          title: 'Windows Installer Package (.msi)',
          tag: 'Enterprise & IT Admin',
          size: msiSize,
          type: 'Wix MSI Package',
          color: 'border-purple-500/30 bg-purple-950/20 text-purple-300',
          btnColor: 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]',
          url: msiUrl,
          desc: 'Windows Installer package supporting group policy deployment and silent enterprise rollouts.',
        };

        if (isMounted) {
          setData({
            version: cleanVersion,
            tagName: rawTag,
            publishedAt: publishedDate,
            htmlUrl: json.html_url || `https://github.com/${REPO}/releases`,
            exeAsset,
            msiAsset,
            assets: [exeAsset, msiAsset],
            body: json.body || '',
            isLoading: false,
          });
        }
      } catch {
        if (isMounted) setData((prev) => ({ ...prev, isLoading: false }));
      }
    }

    fetchLatestRelease();

    return () => {
      isMounted = false;
    };
  }, []);

  return data;
}
