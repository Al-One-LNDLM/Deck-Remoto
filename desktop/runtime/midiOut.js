let MidiLibrary = null;
let output = null;
let initAttempted = false;
let loggedUnavailable = false;
let loggedMissingPort = false;
let selectedOutputIndex = -1;

function logUnavailableOnce(message) {
  if (loggedUnavailable) {
    return;
  }
  loggedUnavailable = true;
  console.warn(message);
}

function logMissingPortOnce() {
  if (loggedMissingPort) {
    return;
  }
  loggedMissingPort = true;
  console.warn("[MIDI] No hay puertos MIDI de salida disponibles.");
}

function ensureOutput() {
  if (!initAttempted) {
    initAttempted = true;

    try {
      MidiLibrary = require("midi");
      console.log("[MIDI] require('midi') ok");
    } catch (error) {
      logUnavailableOnce(`[MIDI] require('midi') error: ${error?.stack || error?.message || String(error)}`);
      return null;
    }

    try {
      output = new MidiLibrary.Output();
    } catch (error) {
      logUnavailableOnce(`[MIDI] No se pudo inicializar la salida MIDI: ${error?.message || String(error)}`);
      output = null;
      return null;
    }

    setOutputByIndex(0);
  }

  return output;
}

function listOutputs() {
  if (!initAttempted) {
    ensureOutput();
  }

  if (!output || typeof output.getPortCount !== "function") {
    return [];
  }

  const portCount = output.getPortCount();
  console.log(`[MIDI] output.getPortCount() = ${portCount}`);
  if (!portCount) {
    logMissingPortOnce();
    return [];
  }

  return Array.from({ length: portCount }, (_, index) => {
    let name = `Output ${index + 1}`;
    if (typeof output.getPortName === "function") {
      try {
        name = output.getPortName(index);
      } catch (error) {
        name = `Output ${index + 1}`;
        console.warn(`[MIDI] output.getPortName(${index}) error: ${error?.stack || error?.message || String(error)}`);
      }
    }
    console.log(`[MIDI] output.getPortName(${index}) = ${name}`);
    return { index, name };
  });
}

function getSelectedOutputIndex() {
  return selectedOutputIndex;
}

function setOutputByIndex(index) {
  if (!initAttempted) {
    ensureOutput();
  }

  const outputs = listOutputs();
  if (!outputs.length) {
    selectedOutputIndex = -1;
    return null;
  }

  const numericIndex = Number(index);
  const targetIndex = Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < outputs.length
    ? numericIndex
    : 0;

  try {
    if (selectedOutputIndex !== -1 && typeof output.closePort === "function") {
      output.closePort();
    }

    output.openPort(targetIndex);
    selectedOutputIndex = targetIndex;
    return outputs[targetIndex];
  } catch (error) {
    console.warn(`[MIDI] Error al abrir puerto MIDI: ${error?.message || String(error)}`);
    selectedOutputIndex = -1;
    return null;
  }
}

function normalizeChannel(channel) {
  if (!Number.isFinite(Number(channel))) {
    return 1;
  }
  return Math.max(1, Math.min(16, Math.round(Number(channel))));
}

function normalizeDataByte(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }
  return Math.max(0, Math.min(127, Math.round(Number(value))));
}

function sendMessage(status, data1, data2) {
  const midiOut = ensureOutput();
  if (!midiOut) {
    return false;
  }

  try {
    midiOut.sendMessage([status, data1, data2]);
    return true;
  } catch (error) {
    console.warn(`[MIDI] Error enviando mensaje: ${error?.message || String(error)}`);
    return false;
  }
}

function sendCc(channel, cc, value) {
  const normalizedChannel = normalizeChannel(channel);
  const status = 0xb0 + (normalizedChannel - 1);
  return sendMessage(status, normalizeDataByte(cc), normalizeDataByte(value));
}

function sendNoteOn(channel, note, velocity) {
  const normalizedChannel = normalizeChannel(channel);
  const status = 0x90 + (normalizedChannel - 1);
  return sendMessage(status, normalizeDataByte(note), normalizeDataByte(velocity));
}

function sendNoteOff(channel, note, velocity) {
  const normalizedChannel = normalizeChannel(channel);
  const status = 0x80 + (normalizedChannel - 1);
  return sendMessage(status, normalizeDataByte(note), normalizeDataByte(velocity));
}

module.exports = {
  listOutputs,
  getSelectedOutputIndex,
  setOutputByIndex,
  sendCc,
  sendNoteOn,
  sendNoteOff,
};
