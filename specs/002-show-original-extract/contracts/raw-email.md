# Extract Contract

Interface specifying the interaction signature between the extracting functions (DOM manipulation layers) and the core logger layer.

## RawEmail Payload
The extraction functions should bypass creating an intermediate format and construct a unified `ExtractionResult` containing `ExtendedEmailData`.

```typescript
// See src/types/email.ts
import { ExtractionResult } from '../../src/types/email';

// Extractor must return:
// ExtractionResult where data conforms to ExtendedEmailData
```

All functions returning extracted values from `show-original-extractor.ts` MUST conform to `ExtractionResult` to be cleanly handed off to the unified logger utility, utilizing a MIME parser to map raw text over to `ExtendedEmailData`.
