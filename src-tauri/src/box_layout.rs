use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScreenBoxRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SmartBoxSpec {
    pub id: String,
    pub desired_x: f64,
    pub desired_y: f64,
    pub preferred_width: f64,
    pub preferred_height: f64,
    pub min_width: f64,
    pub min_height: f64,
    pub max_width: f64,
    pub max_height: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SmartBoxLayoutInput {
    pub viewport_width: f64,
    pub viewport_height: f64,
    pub gap: f64,
    pub margin: f64,
    pub priority_order: Vec<String>,
    pub obstacles: Vec<ScreenBoxRect>,
    pub boxes: Vec<SmartBoxSpec>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SolvedBoxRect {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PresetDashboardOutput {
    pub bot_pos: ScreenBoxRect,
    pub rects: HashMap<String, SolvedBoxRect>,
}

const SCALE_STEPS: [f64; 6] = [1.0, 0.92, 0.84, 0.76, 0.68, 0.60];

fn clamp_f64(val: f64, min: f64, max: f64) -> f64 {
    val.max(min).min(max.max(min))
}

fn rects_overlap(a: &ScreenBoxRect, b: &ScreenBoxRect, gap: f64) -> bool {
    !(a.x + a.width + gap <= b.x
        || b.x + b.width + gap <= a.x
        || a.y + a.height + gap <= b.y
        || b.y + b.height + gap <= a.y)
}

fn overlap_area(a: &ScreenBoxRect, b: &ScreenBoxRect, gap: f64) -> f64 {
    let half = gap * 0.5;
    let ax1 = a.x - half;
    let ay1 = a.y - half;
    let ax2 = a.x + a.width + half;
    let ay2 = a.y + a.height + half;

    let bx1 = b.x - half;
    let by1 = b.y - half;
    let bx2 = b.x + b.width + half;
    let by2 = b.y + b.height + half;

    let ox = (ax2.min(bx2) - ax1.max(bx1)).max(0.0);
    let oy = (ay2.min(by2) - ay1.max(by1)).max(0.0);
    ox * oy
}

fn clamp_rect_to_viewport(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    vw: f64,
    vh: f64,
    margin: f64,
) -> ScreenBoxRect {
    let safe_w = width.min((vw - margin * 2.0).max(160.0));
    let safe_h = height.min((vh - margin * 2.0).max(160.0));
    let max_x = (vw - safe_w - margin).max(margin);
    let max_y = (vh - safe_h - margin).max(margin);
    ScreenBoxRect {
        x: clamp_f64(x, margin, max_x).round(),
        y: clamp_f64(y, margin, max_y).round(),
        width: safe_w.round(),
        height: safe_h.round(),
    }
}

fn push_unique_coord(coords: &mut Vec<(f64, f64)>, cand: (f64, f64)) {
    let rx = cand.0.round();
    let ry = cand.1.round();
    if !coords.iter().any(|&(cx, cy)| (cx - rx).abs() < 1.0 && (cy - ry).abs() < 1.0) {
        coords.push((rx, ry));
    }
}

fn pack_boxes_with_scale_cap(
    ordered: &[SmartBoxSpec],
    vw: f64,
    vh: f64,
    gap: f64,
    margin: f64,
    initial_obstacles: &[ScreenBoxRect],
    max_scale: f64,
) -> (HashMap<String, SolvedBoxRect>, usize, f64) {
    let mut occupied: Vec<ScreenBoxRect> = initial_obstacles.to_vec();
    let mut solved: HashMap<String, SolvedBoxRect> = HashMap::new();
    let mut collisions = 0usize;
    let mut total_penalty = 0.0f64;

    for spec in ordered {
        let max_fit_w = (vw - margin * 2.0).max(180.0);
        let max_fit_h = (vh - margin * 2.0).max(180.0);
        let base_w = clamp_f64(spec.preferred_width, spec.min_width, spec.max_width).min(max_fit_w);
        let base_h = clamp_f64(spec.preferred_height, spec.min_height, spec.max_height).min(max_fit_h);

        let mut chosen: Option<SolvedBoxRect> = None;
        let mut fallback_best: Option<(f64, SolvedBoxRect)> = None;

        for &scale in &SCALE_STEPS {
            if scale > max_scale + 1e-6 {
                continue;
            }
            let w = clamp_f64((base_w * scale).round(), spec.min_width.min(max_fit_w), max_fit_w);
            let h = clamp_f64((base_h * scale).round(), spec.min_height.min(max_fit_h), max_fit_h);

            let desired = clamp_rect_to_viewport(spec.desired_x, spec.desired_y, w, h, vw, vh, margin);
            let mut candidates: Vec<(f64, f64)> = Vec::new();
            push_unique_coord(&mut candidates, (desired.x, desired.y));

            for obs in &occupied {
                push_unique_coord(&mut candidates, (obs.x - gap - w, desired.y));
                push_unique_coord(&mut candidates, (obs.x + obs.width + gap, desired.y));
                push_unique_coord(&mut candidates, (desired.x, obs.y - gap - h));
                push_unique_coord(&mut candidates, (desired.x, obs.y + obs.height + gap));
                push_unique_coord(&mut candidates, (obs.x - gap - w, obs.y));
                push_unique_coord(&mut candidates, (obs.x + obs.width + gap, obs.y));
                push_unique_coord(&mut candidates, (obs.x, obs.y - gap - h));
                push_unique_coord(&mut candidates, (obs.x, obs.y + obs.height + gap));
            }

            let max_x = (vw - w - margin).max(margin);
            let max_y = (vh - h - margin).max(margin);
            let step_x = ((max_x - margin) / 7.0).max(40.0);
            let step_y = ((max_y - margin) / 6.0).max(40.0);

            let mut gy = margin;
            while gy <= max_y + 0.5 {
                let mut gx = margin;
                while gx <= max_x + 0.5 {
                    push_unique_coord(&mut candidates, (gx, gy));
                    gx += step_x;
                }
                gy += step_y;
            }
            push_unique_coord(&mut candidates, (max_x, margin));
            push_unique_coord(&mut candidates, (margin, max_y));
            push_unique_coord(&mut candidates, (max_x, max_y));

            candidates.sort_by(|a, b| {
                let da = (a.0 - desired.x).powi(2) + (a.1 - desired.y).powi(2);
                let db = (b.0 - desired.x).powi(2) + (b.1 - desired.y).powi(2);
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            });

            for (cx, cy) in candidates {
                let rect = clamp_rect_to_viewport(cx, cy, w, h, vw, vh, margin);
                let total_overlap: f64 = occupied.iter().map(|obs| overlap_area(&rect, obs, gap)).sum();
                let dist = ((rect.x - desired.x).powi(2) + (rect.y - desired.y).powi(2)).sqrt();
                let penalty = total_overlap * 1000.0 + dist;

                let zero_collision = !occupied.iter().any(|obs| rects_overlap(&rect, obs, gap));
                let candidate_solved = SolvedBoxRect {
                    id: spec.id.clone(),
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    scale,
                };

                if zero_collision {
                    chosen = Some(candidate_solved);
                    break;
                }

                match &fallback_best {
                    Some((best_pen, _)) if penalty >= *best_pen => {}
                    _ => fallback_best = Some((penalty, candidate_solved)),
                }
            }

            if chosen.is_some() {
                break;
            }
        }

        let final_rect = if let Some(r) = chosen {
            r
        } else {
            collisions += 1;
            if let Some((pen, r)) = fallback_best {
                total_penalty += pen;
                r
            } else {
                SolvedBoxRect {
                    id: spec.id.clone(),
                    x: spec.desired_x.round(),
                    y: spec.desired_y.round(),
                    width: base_w.round(),
                    height: base_h.round(),
                    scale: max_scale,
                }
            }
        };

        occupied.push(ScreenBoxRect {
            x: final_rect.x,
            y: final_rect.y,
            width: final_rect.width,
            height: final_rect.height,
        });
        solved.insert(spec.id.clone(), final_rect);
    }

    (solved, collisions, total_penalty)
}

pub fn solve_smart_box_layout_internal(input: SmartBoxLayoutInput) -> HashMap<String, SolvedBoxRect> {
    let vw = input.viewport_width.max(640.0);
    let vh = input.viewport_height.max(480.0);
    let gap = input.gap.max(8.0);
    let margin = input.margin.max(8.0);

    let mut ordered = input.boxes.clone();
    ordered.sort_by_key(|spec| {
        input
            .priority_order
            .iter()
            .position(|id| id == &spec.id)
            .unwrap_or(usize::MAX)
    });

    let mut area_sorted = ordered.clone();
    area_sorted.sort_by(|a, b| {
        let aa = a.min_width * a.min_height;
        let ba = b.min_width * b.min_height;
        ba.partial_cmp(&aa).unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut reversed = ordered.clone();
    reversed.reverse();

    let mut best_result: Option<(usize, f64, HashMap<String, SolvedBoxRect>)> = None;
    for &cap in &SCALE_STEPS {
        for pass_order in [&ordered, &area_sorted, &reversed] {
            let (solved, collisions, penalty) =
                pack_boxes_with_scale_cap(pass_order, vw, vh, gap, margin, &input.obstacles, cap);
            if collisions == 0 {
                return solved;
            }
            match &best_result {
                Some((best_c, best_p, _))
                    if collisions > *best_c || (collisions == *best_c && penalty >= *best_p) => {}
                _ => best_result = Some((collisions, penalty, solved)),
            }
        }
    }

    best_result.map(|(_, _, s)| s).unwrap_or_default()
}

pub fn compute_preset_dashboard_internal(
    viewport_width: f64,
    viewport_height: f64,
    bot_width: f64,
    bot_height: f64,
) -> PresetDashboardOutput {
    let vw = viewport_width.max(760.0);
    let vh = viewport_height.max(540.0);
    let margin = 18.0;
    let gap = 16.0;

    // Bot always anchors top-right in Preset Dashboard mode
    let bot_pos = ScreenBoxRect {
        x: (vw - margin - bot_width).max(margin).round(),
        y: margin.round(),
        width: bot_width.round(),
        height: bot_height.round(),
    };

    let history_w = clamp_f64(vw * 0.21, 270.0, 340.0);
    let history_h = clamp_f64(vh * 0.42, 260.0, 420.0);

    let music_w = clamp_f64(vw * 0.24, 300.0, 392.0);
    let music_h = clamp_f64(vh * 0.41, 260.0, 410.0);

    let tm_w = clamp_f64(vw * 0.26, 320.0, 440.0);
    let tm_h = clamp_f64(vh * 0.42, 260.0, 420.0);

    let wb_w = clamp_f64(vw * 0.36, 380.0, 540.0);
    let wb_h = clamp_f64(vh * 0.45, 290.0, 470.0);

    let set_w = clamp_f64(vw * 0.31, 340.0, 430.0);
    let set_h = clamp_f64(vh * 0.47, 300.0, 490.0);

    let tm_desired_x = (bot_pos.x - gap - tm_w).max(margin);
    let music_desired_x = ((vw - music_w) * 0.5).clamp(margin + history_w + gap * 0.5, (tm_desired_x - music_w - gap * 0.5).max(margin));

    let specs = vec![
        SmartBoxSpec {
            id: "taskmanager".to_string(),
            desired_x: tm_desired_x,
            desired_y: margin,
            preferred_width: tm_w,
            preferred_height: tm_h,
            min_width: 280.0,
            min_height: 240.0,
            max_width: 480.0,
            max_height: 520.0,
        },
        SmartBoxSpec {
            id: "music".to_string(),
            desired_x: music_desired_x,
            desired_y: margin,
            preferred_width: music_w,
            preferred_height: music_h,
            min_width: 270.0,
            min_height: 240.0,
            max_width: 440.0,
            max_height: 520.0,
        },
        SmartBoxSpec {
            id: "history".to_string(),
            desired_x: margin,
            desired_y: margin,
            preferred_width: history_w,
            preferred_height: history_h,
            min_width: 250.0,
            min_height: 230.0,
            max_width: 400.0,
            max_height: 500.0,
        },
        SmartBoxSpec {
            id: "wellbeing".to_string(),
            desired_x: margin,
            desired_y: (vh - margin - wb_h).max(margin + history_h + gap),
            preferred_width: wb_w,
            preferred_height: wb_h,
            min_width: 320.0,
            min_height: 270.0,
            max_width: 620.0,
            max_height: 600.0,
        },
        SmartBoxSpec {
            id: "settings".to_string(),
            desired_x: (vw - margin - set_w).max(margin + wb_w + gap),
            desired_y: (vh - margin - set_h).max(margin + bot_pos.height.max(tm_h) + gap),
            preferred_width: set_w,
            preferred_height: set_h,
            min_width: 300.0,
            min_height: 270.0,
            max_width: 500.0,
            max_height: 620.0,
        },
    ];

    let rects = solve_smart_box_layout_internal(SmartBoxLayoutInput {
        viewport_width: vw,
        viewport_height: vh,
        gap,
        margin,
        priority_order: vec![
            "taskmanager".to_string(),
            "music".to_string(),
            "wellbeing".to_string(),
            "settings".to_string(),
            "history".to_string(),
        ],
        obstacles: vec![bot_pos.clone()],
        boxes: specs,
    });

    PresetDashboardOutput { bot_pos, rects }
}

#[tauri::command]
pub fn compute_smart_box_layout(input: SmartBoxLayoutInput) -> HashMap<String, SolvedBoxRect> {
    solve_smart_box_layout_internal(input)
}

#[tauri::command]
pub fn compute_preset_dashboard_layout(
    viewport_width: f64,
    viewport_height: f64,
    bot_width: f64,
    bot_height: f64,
) -> PresetDashboardOutput {
    compute_preset_dashboard_internal(viewport_width, viewport_height, bot_width, bot_height)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn to_rect(r: &SolvedBoxRect) -> ScreenBoxRect {
        ScreenBoxRect {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
        }
    }

    #[test]
    fn preset_dashboard_has_zero_overlap_on_1080p_and_768p() {
        for (vw, vh) in [(1920.0, 1080.0), (1366.0, 768.0)] {
            let out = compute_preset_dashboard_internal(vw, vh, 160.0, 175.0);
            assert_eq!(out.rects.len(), 5);
            // Bot is top-right
            assert!(out.bot_pos.x > vw * 0.75);
            assert!(out.bot_pos.y < 40.0);

            // Check preset quadrants
            let tm = &out.rects["taskmanager"];
            let music = &out.rects["music"];
            let wb = &out.rects["wellbeing"];
            let settings = &out.rects["settings"];
            assert!(tm.x > vw * 0.45 && tm.y < vh * 0.3);
            assert!(music.x > out.rects["history"].x && music.x < tm.x);
            assert!(wb.x < vw * 0.2 && wb.y > vh * 0.35);
            assert!(settings.x > vw * 0.45 && settings.y > vh * 0.35);

            let mut all_rects: Vec<ScreenBoxRect> = out.rects.values().map(to_rect).collect();
            all_rects.push(out.bot_pos.clone());
            for i in 0..all_rects.len() {
                for j in (i + 1)..all_rects.len() {
                    assert!(
                        !rects_overlap(&all_rects[i], &all_rects[j], 12.0),
                        "Overlap found at {}x{} between {:?} and {:?}",
                        vw,
                        vh,
                        all_rects[i],
                        all_rects[j]
                    );
                }
            }
        }
    }

    #[test]
    fn smart_layout_shrinks_boxes_in_tight_space_and_restores_when_clear() {
        let specs = vec![
            SmartBoxSpec {
                id: "settings".to_string(),
                desired_x: 400.0,
                desired_y: 80.0,
                preferred_width: 430.0,
                preferred_height: 520.0,
                min_width: 300.0,
                min_height: 270.0,
                max_width: 500.0,
                max_height: 600.0,
            },
            SmartBoxSpec {
                id: "wellbeing".to_string(),
                desired_x: 20.0,
                desired_y: 80.0,
                preferred_width: 520.0,
                preferred_height: 500.0,
                min_width: 320.0,
                min_height: 270.0,
                max_width: 600.0,
                max_height: 600.0,
            },
        ];

        // Tight viewport: forces auto-smallen while preventing collision
        let tight = solve_smart_box_layout_internal(SmartBoxLayoutInput {
            viewport_width: 820.0,
            viewport_height: 640.0,
            gap: 16.0,
            margin: 16.0,
            priority_order: vec!["settings".to_string(), "wellbeing".to_string()],
            obstacles: vec![],
            boxes: specs.clone(),
        });
        assert!(tight["wellbeing"].scale < 1.0);
        assert!(!rects_overlap(&to_rect(&tight["settings"]), &to_rect(&tight["wellbeing"]), 12.0));

        // Open viewport: automatically expands back to full preferred scale = 1.0
        let open = solve_smart_box_layout_internal(SmartBoxLayoutInput {
            viewport_width: 1400.0,
            viewport_height: 900.0,
            gap: 16.0,
            margin: 16.0,
            priority_order: vec!["settings".to_string(), "wellbeing".to_string()],
            obstacles: vec![],
            boxes: specs,
        });
        assert!((open["wellbeing"].scale - 1.0).abs() < f64::EPSILON);
        assert_eq!(open["wellbeing"].width, 520.0);
    }
}
