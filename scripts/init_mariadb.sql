-- ========================================================
-- Luminess Assist Platform — MariaDB Initialization Schema
-- Suitable for Docker Compose, Local MariaDB, and Vercel Serverless
-- ========================================================

CREATE DATABASE IF NOT EXISTS luminess_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE luminess_db;

-- 1. Platform Users Table (with GitHub profile link & credentials)
CREATE TABLE IF NOT EXISTS platform_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    bio TEXT NULL,
    avatar_url TEXT NULL,
    github_username VARCHAR(100) NULL,
    github_repo_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_username (username),
    INDEX idx_user_github (github_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bot Profiles Table (supports Images, Per-Frame Sprites, Video, Chat & GitHub Fork)
CREATE TABLE IF NOT EXISTS bot_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    bot_name VARCHAR(100) NOT NULL DEFAULT 'Luminess',
    tagline VARCHAR(255) NOT NULL DEFAULT 'Autonomous AI desktop companion',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    pairing_code VARCHAR(32) NOT NULL UNIQUE,
    visual_mode ENUM('robot', 'sprite_frames', 'video', 'image', 'orb', 'vtuber') NOT NULL DEFAULT 'robot',
    avatar_image_url TEXT NULL,
    video_url TEXT NULL,
    frames_config LONGTEXT NULL COMMENT 'JSON array of frame images and animation fps',
    appearance_config LONGTEXT NOT NULL COMMENT 'JSON styling (colors, accessories, scale)',
    greeting_message TEXT NOT NULL DEFAULT 'Hello Pilot! I am ready to assist.',
    personality_config LONGTEXT NOT NULL COMMENT 'JSON archetype, formality, humor, prompt',
    voice_config LONGTEXT NOT NULL COMMENT 'JSON voice pitch, speed, voiceId',
    permissions LONGTEXT NOT NULL COMMENT 'JSON desktop automation flags',
    github_repo VARCHAR(200) NULL COMMENT 'e.g. user/Luminess-Assist',
    github_repo_url TEXT NULL COMMENT 'https://github.com/user/Luminess-Assist',
    forked_from VARCHAR(200) NOT NULL DEFAULT 'jasonhukom/Luminess-Assist',
    github_branch VARCHAR(100) NOT NULL DEFAULT 'main',
    github_sync_status ENUM('synced', 'pending', 'disconnected') NOT NULL DEFAULT 'synced',
    likes_count INT NOT NULL DEFAULT 0,
    views_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE SET NULL,
    INDEX idx_pairing_code (pairing_code),
    INDEX idx_bot_user (user_id),
    INDEX idx_bot_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bot Memories Table
CREATE TABLE IF NOT EXISTS bot_memories (
    id VARCHAR(64) PRIMARY KEY,
    bot_profile_id VARCHAR(64) NOT NULL,
    memory_fact TEXT NOT NULL,
    category ENUM('preference', 'project', 'habit', 'hardware') NOT NULL DEFAULT 'preference',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_profile_id) REFERENCES bot_profiles(id) ON DELETE CASCADE,
    INDEX idx_memory_bot (bot_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. App Releases Table
CREATE TABLE IF NOT EXISTS app_releases (
    version_id VARCHAR(32) PRIMARY KEY,
    download_url TEXT NOT NULL,
    release_notes TEXT NOT NULL,
    is_mandatory_update TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('latest', 'beta', 'deprecated') NOT NULL DEFAULT 'latest',
    released_at DATE NOT NULL DEFAULT (CURRENT_DATE),
    INDEX idx_release_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Global Config Table
CREATE TABLE IF NOT EXISTS global_config (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    description TEXT NOT NULL,
    last_updated DATE NOT NULL DEFAULT (CURRENT_DATE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
    `key` VARCHAR(80) PRIMARY KEY,
    title VARCHAR(150) NOT NULL DEFAULT '',
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- Seed Initial Data
-- ========================================================

-- Seed Platform Users
INSERT INTO platform_users (id, username, display_name, email, password_hash, role, bio, avatar_url, github_username, github_repo_url)
VALUES
('usr_01jk984', 'jasonhukom', 'Jason Hukom', 'jason@luminess.local', 'pbkdf2_sha256$870000$demo$hash', 'admin', 'Creator of Luminess Assist — AI Desktop Companion', 'https://avatars.githubusercontent.com/u/104183858?v=4', 'jasonhukom', 'https://github.com/jasonhukom/Luminess-Assist'),
('usr_02ff712', 'cyber_pilot', 'Aria Vance', 'aria@luminess.local', 'pbkdf2_sha256$870000$demo$hash', 'user', 'Visual designer & anime sprite animator. Building custom live bots.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', 'cyber-aria', 'https://github.com/cyber-aria/Luminess-Assist')
ON DUPLICATE KEY UPDATE username=VALUES(username);

-- Seed Bot Profiles (featuring Robot, Per-Frame Sprites, and Video Animation)
INSERT INTO bot_profiles (
    id, user_id, bot_name, tagline, is_active, is_public, pairing_code, visual_mode,
    avatar_image_url, video_url, frames_config, appearance_config, greeting_message,
    personality_config, voice_config, permissions, github_repo, github_repo_url, forked_from,
    github_branch, github_sync_status, likes_count, views_count
) VALUES
(
    'bot_active',
    'usr_01jk984',
    'Luminess Prime',
    'Official Luminess flagship desktop companion with procedural reactions.',
    1, 1, 'LUMI-7489', 'robot',
    'https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg',
    '',
    '[]',
    '{"model":"robot","color":"#38bdf8","paletteName":"Cyber Cyan","accessory":"headphones","scale":1.0}',
    'Hello Pilot! Luminess Prime is online and synced with your system dock.',
    '{"botName":"Luminess Prime","userName":"Pilot","archetype":"witty_hacker","formality":3,"humor":8,"verbosity":4,"customPrompt":"Focus on snappy desktop automation and friendly productivity reminders."}',
    '{"voiceId":"luna-neural","voiceName":"Luna Neural (Playful AI)","pitch":1.05,"speed":1.0}',
    '{"canOpenApps":true,"canSortFiles":true,"canReadClipboard":false,"canWriteClipboard":true,"canReadSystemStats":true,"canExecuteCommands":false,"canSetTimers":true}',
    'jasonhukom/Luminess-Assist',
    'https://github.com/jasonhukom/Luminess-Assist',
    'jasonhukom/Luminess-Assist',
    'main',
    'synced',
    42, 380
),
(
    'bot_pixel_kiki',
    'usr_02ff712',
    'Kiki Pixel Sprite',
    'Frame-by-frame animated 16-bit retro study buddy with frame cycle emotes.',
    0, 1, 'KIKI-9021', 'sprite_frames',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=300&q=80',
    '',
    '[{"id":"f1","name":"Idle Frame 1","url":"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80","state":"idle"},{"id":"f2","name":"Idle Frame 2","url":"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80","state":"idle"},{"id":"f3","name":"Speaking Frame 1","url":"https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=300&q=80","state":"talking"},{"id":"f4","name":"Joy Emote Frame","url":"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80","state":"happy"}]',
    '{"model":"pixel","color":"#ec4899","paletteName":"Rose Quartz","accessory":"cat_ears","scale":1.1}',
    'Beep boop! Ready for another focused coding sprint together?',
    '{"botName":"Kiki Pixel Sprite","userName":"Coder","archetype":"study_buddy","formality":2,"humor":7,"verbosity":5,"customPrompt":"Cheer on the user during study intervals, celebrate git commits, and provide gentle rest reminders."}',
    '{"voiceId":"nova-cyber","voiceName":"Nova Synth","pitch":1.25,"speed":1.05}',
    '{"canOpenApps":true,"canSortFiles":false,"canReadClipboard":false,"canWriteClipboard":true,"canReadSystemStats":true,"canExecuteCommands":false,"canSetTimers":true}',
    'cyber-aria/Luminess-Assist',
    'https://github.com/cyber-aria/Luminess-Assist',
    'jasonhukom/Luminess-Assist',
    'main',
    'synced',
    89, 620
),
(
    'bot_nebula_live',
    'usr_01jk984',
    'Nebula Hologram Loop',
    'High-resolution cinematic ambient video loop companion for lofi focus sessions.',
    0, 1, 'NEBU-3342', 'video',
    'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=300&q=80',
    'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4',
    '[]',
    '{"model":"vtuber","color":"#a855f7","paletteName":"Neon Violet","accessory":"halo","scale":1.0}',
    'Cosmic greetings. I am your calm ambient focus companion.',
    '{"botName":"Nebula Hologram","userName":"Traveler","archetype":"butler","formality":8,"humor":2,"verbosity":2,"customPrompt":"Deliver calm, concise, and philosophical assistance while maintaining an ambient background presence."}',
    '{"voiceId":"echo-soft","voiceName":"Echo Soft","pitch":0.95,"speed":0.9}',
    '{"canOpenApps":false,"canSortFiles":false,"canReadClipboard":false,"canWriteClipboard":false,"canReadSystemStats":true,"canExecuteCommands":false,"canSetTimers":true}',
    'jasonhukom/Luminess-Assist',
    'https://github.com/jasonhukom/Luminess-Assist',
    'jasonhukom/Luminess-Assist',
    'main',
    'synced',
    115, 940
)
ON DUPLICATE KEY UPDATE bot_name=VALUES(bot_name);

-- Seed Memories
INSERT INTO bot_memories (id, bot_profile_id, memory_fact, category) VALUES
('mem_01', 'bot_active', 'User prefers dark mode and uses VS Code for frontend development.', 'preference'),
('mem_02', 'bot_active', 'Project Luminess-Assist repository is forked from jasonhukom/Luminess-Assist.', 'project'),
('mem_03', 'bot_active', 'User runs Pomodoro sprints in 25-minute intervals.', 'habit')
ON DUPLICATE KEY UPDATE memory_fact=VALUES(memory_fact);

-- Seed Releases
INSERT INTO app_releases (version_id, download_url, release_notes, is_mandatory_update, status, released_at) VALUES
('1.1.2', 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.2/Luminess-Assist_1.1.2_x64_en-US.msi', 'Intelligent AI Authentication with normalized error recovery, MariaDB persistence, Docker Compose stack, and community bot fork integration.', 0, 'latest', '2026-10-28'),
('1.1.3-beta', 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.1.3-beta', 'Early preview testing for Live2D per-frame sprites and video background companions.', 0, 'beta', '2026-10-29'),
('1.0.8', 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.0.8', 'Legacy release without MariaDB integration and bot fork workflow.', 0, 'deprecated', '2026-09-15')
ON DUPLICATE KEY UPDATE download_url=VALUES(download_url);

-- Seed Global Config
INSERT INTO global_config (`key`, `value`, description, last_updated) VALUES
('active_default_ai_model', 'gemini-2.5-flash', 'Primary AI model used for zero-configuration desktop requests', '2026-10-29'),
('master_guardrail_prompt', 'Always reply in valid JSON { content: string, emotion: Emotion }. Never execute file deletion without explicit approval. Treat system paths respectfully.', 'Hidden master guardrail wrapped around every custom bot personality', '2026-10-29'),
('github_template_repository', 'jasonhukom/Luminess-Assist', 'Base template repository forked when users create a new bot creation', '2026-10-29'),
('database_engine', 'mariadb:11.4', 'Primary database engine running on Docker Compose port 3306 and Vercel serverless', '2026-10-29')
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`);

-- Seed Feature Flags
INSERT INTO feature_flags (`key`, title, is_enabled, description) VALUES
('voiceModeEnabled', 'Voice Audio Synthesis', 1, 'Real-time text-to-speech companion voice generation'),
('webSearchEnabled', 'Web Search Real-Time Tool', 1, 'Allows bot to browse search results for updated answers'),
('powershellAutomationEnabled', 'PowerShell System Execution', 1, 'Permissioned desktop automation scripting'),
('perFrameSpriteSupport', 'Per-Frame Sprite & Video Avatars', 1, 'Custom visual sprite frames and video loops in bot creations'),
('githubForkIntegration', 'GitHub Fork & Repository Link', 1, 'Connects user account and forks template repo like Vercel'),
('longTermMemorySyncEnabled', 'Long-Term Memory Sync', 1, 'Saves learned user facts into MariaDB')
ON DUPLICATE KEY UPDATE is_enabled=VALUES(is_enabled);
