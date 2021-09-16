// Copyright © 2021 Kaleido, Inc.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ApiProperty } from '@nestjs/swagger';

export interface EventStream {
  id: string;
  name: string;
}

export interface EventStreamSubscription {
  id: string;
  name: string;
  stream: string;
}

export interface Event {
  signature: string;
  address: string;
  blockNumber: string;
  transactionIndex: string;
  transactionHash: string;
  data: any;
  inputMethod?: string;
  inputArgs?: Record<string, any>;
}

export class EventStreamReplyHeaders {
  @ApiProperty()
  type: string;

  @ApiProperty()
  requestId: string;
}

export class EventStreamReply {
  @ApiProperty()
  headers: EventStreamReplyHeaders;

  @ApiProperty()
  transactionHash: string;

  @ApiProperty()
  errorMessage?: string;
}
