#!/bin/bash
set -e

LIB=lib
OUT=out
JDA_VERSION=5.2.1
JDA_JAR="$LIB/JDA-${JDA_VERSION}-withDependencies.jar"

mkdir -p "$LIB" "$OUT"

# Télécharger JDA si absent
if [ ! -f "$JDA_JAR" ]; then
    echo "Téléchargement de JDA ${JDA_VERSION}..."
    curl -L -o "$JDA_JAR" \
        "https://github.com/discord-jda/JDA/releases/download/v${JDA_VERSION}/JDA-${JDA_VERSION}-withDependencies.jar"
    echo "JDA téléchargé."
fi

# Compiler
echo "Compilation..."
javac -encoding UTF-8 -cp "$JDA_JAR" -d "$OUT" src/*.java
echo "Compilation OK."

echo ""
echo "Pour lancer le bot :"
echo "  java -Djava.awt.headless=true -cp \"$OUT:$JDA_JAR\" DiscordBot"
