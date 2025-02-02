/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html

interface AudioTrackList {
  [Symbol.iterator](): IterableIterator<unknown>;
  length: number;
}

interface HTMLVideoElement {
  readonly audioTracks?: AudioTrackList;
  readonly mozHasAudio?: boolean;
  readonly webkitAudioDecodedByteCount?: number;
}

/**
 * Determines whether a video element has audio tracks.
 *
 * @param video Video element.
 * @return Whether the video has audio or not.
 */
function hasVideoGotAudio(video: HTMLVideoElement): boolean {
  return (
    video.mozHasAudio ||
    Boolean(video.webkitAudioDecodedByteCount) ||
    Boolean(video.audioTracks?.length)
  );
}

export default hasVideoGotAudio;
