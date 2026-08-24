"""Communication metrics derived from a recording's transcript and
Whisper segment timings.

These are observable-content indicators (speaking time, pace, filler
word usage, silence gaps). They are NOT measures of personality,
emotion, confidence or mental state.
"""

import re

FILLER_PATTERNS = [
    r"\bum\b",
    r"\buh\b",
    r"\ber\b",
    r"\bah\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bbasically\b",
    r"\bactually\b",
    r"\bliterally\b",
    r"\bi mean\b",
]

MIN_PAUSE_SECONDS = 0.6


def analyze_transcript_metrics(transcript: str, segments: list[dict]) -> dict:
    words = transcript.split()
    word_count = len(words)

    if segments:
        duration_seconds = max(
            0.0, float(segments[-1]["end"]) - float(segments[0]["start"])
        )
        pause_total = 0.0
        pause_count = 0

        for previous, current in zip(segments, segments[1:]):
            gap = float(current["start"]) - float(previous["end"])
            if gap >= MIN_PAUSE_SECONDS:
                pause_total += gap
                pause_count += 1
    else:
        duration_seconds = 0.0
        pause_total = 0.0
        pause_count = 0

    wpm = (
        round(word_count / (duration_seconds / 60.0), 1)
        if duration_seconds >= 1.0 and word_count > 0
        else None
    )

    lower_transcript = transcript.lower()
    filler_count = sum(
        len(re.findall(pattern, lower_transcript))
        for pattern in FILLER_PATTERNS
    )

    return {
        "duration_seconds": round(duration_seconds, 1),
        "word_count": word_count,
        "words_per_minute": wpm,
        "filler_word_count": filler_count,
        "pause_count": pause_count,
        "pause_total_seconds": round(pause_total, 1),
    }
