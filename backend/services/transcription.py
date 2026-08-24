import os

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en")

_model = None


class TranscriptionUnavailableError(RuntimeError):
    """Raised when local speech-to-text cannot run."""


def _get_model():
    global _model

    if _model is not None:
        return _model

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise TranscriptionUnavailableError(
            "Speech-to-text dependencies are not installed. "
            "Run: python -m pip install -r requirements.txt"
        )

    try:
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    except Exception as exc:
        raise TranscriptionUnavailableError(
            f"Could not load the local Whisper model '{WHISPER_MODEL}': {exc}"
        )

    return _model


def transcribe_audio_detailed(audio_path: str) -> tuple[str, list[dict]]:
    """Transcribe an audio file locally using faster-whisper.

    Returns (transcript, segments) where each segment is
    {"start": float, "end": float}. The audio never leaves this machine.
    """
    model = _get_model()

    try:
        raw_segments, _info = model.transcribe(audio_path, beam_size=1)
        segments = []
        texts = []

        for segment in raw_segments:
            segments.append(
                {"start": round(segment.start, 2), "end": round(segment.end, 2)}
            )
            texts.append(segment.text.strip())

    except Exception as exc:
        raise TranscriptionUnavailableError(
            f"Answer transcription failed: {exc}"
        )

    return " ".join(text for text in texts if text).strip(), segments


def transcribe_audio(audio_path: str) -> str:
    """Simple wrapper returning only the transcript text."""
    transcript, _segments = transcribe_audio_detailed(audio_path)
    return transcript
