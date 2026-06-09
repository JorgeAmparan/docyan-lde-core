"""Parseo tolerante de JSON devuelto por un LLM (B9.5 auto-extracción)."""
from __future__ import annotations

import json
import re
from typing import Any


def parse_llm_json(texto: str) -> Any | None:
    """
    Extrae el primer objeto/array JSON del texto del LLM. Tolera fences ```json```,
    prosa antes/después y comas colgantes simples. Devuelve None si no parsea.
    """
    if not texto:
        return None
    t = texto.strip()
    # Quita fences de código.
    fence = re.search(r"```(?:json)?\s*(.*?)```", t, re.DOTALL)
    if fence:
        t = fence.group(1).strip()
    # Recorta al primer { o [ y su cierre balanceado más externo.
    start = next((i for i, c in enumerate(t) if c in "{["), -1)
    if start == -1:
        return None
    abre = t[start]
    cierra = "}" if abre == "{" else "]"
    profundidad = 0
    fin = -1
    en_cadena = False
    escapando = False
    for i in range(start, len(t)):
        c = t[i]
        if en_cadena:
            if escapando:
                escapando = False
            elif c == "\\":
                escapando = True
            elif c == '"':
                en_cadena = False
            continue
        if c == '"':
            en_cadena = True
        elif c == abre:
            profundidad += 1
        elif c == cierra:
            profundidad -= 1
            if profundidad == 0:
                fin = i + 1
                break
    if fin == -1:
        return None
    fragmento = t[start:fin]
    try:
        return json.loads(fragmento)
    except json.JSONDecodeError:
        # Reintento quitando comas colgantes.
        limpio = re.sub(r",\s*([}\]])", r"\1", fragmento)
        try:
            return json.loads(limpio)
        except json.JSONDecodeError:
            return None
