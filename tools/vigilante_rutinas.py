#!/usr/bin/env python3
"""Vigilante de las rutinas de producción (solo lectura).

Las rutinas que producen y corrigen los resúmenes corren en la PC del editor. Si la PC está apagada o
suspendida, o las rutinas no pueden correr, no llega nada a main y nadie se entera. Este script mira el
historial de main y dice si hay que avisar. No modifica nada.

Uso: python3 tools/vigilante_rutinas.py [--ahora ISO] [--horas-main 26] [--horas-altas 30]
Sale con 0 si todo está en orden y con 3 si hay alerta. Imprime el mensaje (una o varias líneas).
Solo usa la biblioteca estándar y git.
"""
import argparse
import datetime as dt
import json
import subprocess

ZONA = dt.timezone(dt.timedelta(hours=-6))  # centro de México


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ahora")
    ap.add_argument("--horas-main", type=float, default=26)
    ap.add_argument("--horas-altas", type=float, default=30)
    ap.add_argument("--ref", default="HEAD")
    a = ap.parse_args()
    ahora = dt.datetime.fromisoformat(a.ahora) if a.ahora else dt.datetime.now(dt.timezone.utc)
    if ahora.tzinfo is None:
        ahora = ahora.replace(tzinfo=dt.timezone.utc)
    commits = []
    for linea in git("log", "-60", "--first-parent", "--format=%cI\t%s", a.ref).splitlines():
        fecha, _, asunto = linea.partition("\t")
        try:
            commits.append((dt.datetime.fromisoformat(fecha), asunto))
        except ValueError:
            pass
    if not commits:
        print("Vigilante: no pude leer el historial de main; no es una alerta de las rutinas.")
        return 0
    horas = lambda f: (ahora - f).total_seconds() / 3600
    local = lambda f: f.astimezone(ZONA).strftime("%d-%m %H:%M")
    ultimo = commits[0]
    altas = [c for c in commits if "auto/resumenes-json-" in c[1]]
    correcciones = [c for c in commits if "claude/correccion-" in c[1]]
    saneamiento = ""
    try:
        aud = json.loads(git("show", f"{a.ref}:auditoria-editorial.json"))
        ab = aud.get("errores_abiertos") or {}
        saneamiento = (f"Saneamiento: quedan {aud.get('archivo', {}).get('sin_auditar')} sin auditar · errores abiertos: "
                       f"{ab.get('CRÍTICO', 0)} críticos, {ab.get('MAYOR', 0)} mayores, {ab.get('MENOR', 0)} menores.")
    except (ValueError, TypeError):
        pass
    motivos = []
    if horas(ultimo[0]) > a.horas_main:
        motivos.append(f"main no cambia desde el {local(ultimo[0])} (hace {int(horas(ultimo[0]))} h)")
    if not altas:
        motivos.append("no hay resúmenes nuevos en los últimos 60 cambios de main")
    elif horas(altas[0][0]) > a.horas_altas:
        motivos.append(f"sin resúmenes nuevos desde el {local(altas[0][0])} (hace {int(horas(altas[0][0]))} h)")
    if motivos:
        print("ALERTA rutinas Resúmenes Trials: " + "; ".join(motivos) + ".")
        print("Lo más probable: la PC está apagada o suspendida, la app de Claude está cerrada o se agotó el límite de uso. "
              "Revisa que la PC esté encendida, la app abierta y las rutinas activas.")
        if correcciones:
            print(f"Última corrección publicada: {local(correcciones[0][0])}.")
        if saneamiento:
            print(saneamiento)
        return 3
    print(f"Vigilante: rutinas al día · último cambio en main hace {int(horas(ultimo[0]))} h · últimos resúmenes nuevos hace "
          f"{int(horas(altas[0][0]))} h. " + saneamiento)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
