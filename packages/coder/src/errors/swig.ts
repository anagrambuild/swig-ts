// ============================================================================
// SwigError (0-49): Core program errors from program/src/error.rs
// ============================================================================

/** InvalidSwigAccountDiscriminator: Invalid discriminator in Swig account data */
const SWIG_ERROR__INVALID_SWIG_ACCOUNT_DISCRIMINATOR = 0x0; // 0
/** OwnerMismatchSwigAccount: Swig account owner does not match expected value */
const SWIG_ERROR__OWNER_MISMATCH_SWIG_ACCOUNT = 0x1; // 1
/** AccountNotEmptySwigAccount: Swig account is not empty when it should be */
const SWIG_ERROR__ACCOUNT_NOT_EMPTY_SWIG_ACCOUNT = 0x2; // 2
/** NotOnCurveSwigAccount: Public key in Swig account is not on the curve */
const SWIG_ERROR__NOT_ON_CURVE_SWIG_ACCOUNT = 0x3; // 3
/** ExpectedSignerSwigAccount: Expected Swig account to be a signer but it isn't */
const SWIG_ERROR__EXPECTED_SIGNER_SWIG_ACCOUNT = 0x4; // 4
/** StateError: General state error in program execution */
const SWIG_ERROR__STATE_ERROR = 0x5; // 5
/** AccountBorrowFailed: Failed to borrow account data */
const SWIG_ERROR__ACCOUNT_BORROW_FAILED = 0x6; // 6
/** InvalidAuthorityType: Invalid authority type specified */
const SWIG_ERROR__INVALID_AUTHORITY_TYPE = 0x7; // 7
/** Cpi: Error during cross-program invocation */
const SWIG_ERROR__CPI = 0x8; // 8
/** InvalidSeedSwigAccount: Invalid seed used for Swig account derivation */
const SWIG_ERROR__INVALID_SEED_SWIG_ACCOUNT = 0x9; // 9
/** MissingInstructions: Required instructions are missing */
const SWIG_ERROR__MISSING_INSTRUCTIONS = 0xa; // 10
/** InvalidAuthorityPayload: Invalid authority payload format */
const SWIG_ERROR__INVALID_AUTHORITY_PAYLOAD = 0xb; // 11
/** InvalidAuthorityNotFoundByRoleId: Authority not found for given role ID */
const SWIG_ERROR__INVALID_AUTHORITY_NOT_FOUND_BY_ROLE_ID = 0xc; // 12
/** InvalidAuthorityMustHaveAtLeastOneAction: Authority must have at least one action */
const SWIG_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION = 0xd; // 13
/** InstructionExecutionError: Error during instruction execution */
const SWIG_ERROR__INSTRUCTION_EXECUTION_ERROR = 0xe; // 14
/** SerializationError: Error during data serialization */
const SWIG_ERROR__SERIALIZATION_ERROR = 0xf; // 15
/** InvalidSwigSignInstructionDataTooShort: Sign instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_SIGN_INSTRUCTION_DATA_TOO_SHORT = 0x10; // 16
/** InvalidSwigRemoveAuthorityInstructionDataTooShort: Remove authority instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_REMOVE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT = 0x11; // 17
/** InvalidSwigAddAuthorityInstructionDataTooShort: Add authority instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_ADD_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT = 0x12; // 18
/** InvalidSwigUpdateAuthorityInstructionDataTooShort: Update authority instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_UPDATE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT = 0x13; // 19
/** InvalidSwigCreateInstructionDataTooShort: Create instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_CREATE_INSTRUCTION_DATA_TOO_SHORT = 0x14; // 20
/** InvalidSwigCreateSessionInstructionDataTooShort: Create session instruction data is too short */
const SWIG_ERROR__INVALID_SWIG_CREATE_SESSION_INSTRUCTION_DATA_TOO_SHORT = 0x15; // 21
/** InvalidAccountsLength: Invalid number of accounts provided */
const SWIG_ERROR__INVALID_ACCOUNTS_LENGTH = 0x16; // 22
/** InvalidAccountsSwigMustBeFirst: Swig account must be the first account in the list */
const SWIG_ERROR__INVALID_ACCOUNTS_SWIG_MUST_BE_FIRST = 0x17; // 23
/** InvalidSystemProgram: Invalid system program account */
const SWIG_ERROR__INVALID_SYSTEM_PROGRAM = 0x18; // 24
/** DuplicateAuthority: Authority already exists */
const SWIG_ERROR__DUPLICATE_AUTHORITY = 0x19; // 25
/** InvalidOperation: Invalid operation attempted */
const SWIG_ERROR__INVALID_OPERATION = 0x1a; // 26
/** InvalidAlignment: Data alignment error */
const SWIG_ERROR__INVALID_ALIGNMENT = 0x1b; // 27
/** InvalidSeedSubAccount: Invalid seed used for sub-account derivation */
const SWIG_ERROR__INVALID_SEED_SUB_ACCOUNT = 0x1c; // 28
/** InsufficientFunds: Insufficient funds for operation */
const SWIG_ERROR__INSUFFICIENT_FUNDS = 0x1d; // 29
/** OwnerMismatchTokenAccount: Token account owner mismatch */
const SWIG_ERROR__OWNER_MISMATCH_TOKEN_ACCOUNT = 0x1e; // 30
/** PermissionDenied: Permission denied for operation */
const SWIG_ERROR__PERMISSION_DENIED = 0x1f; // 31
/** InvalidSignature: Invalid signature provided */
const SWIG_ERROR__INVALID_SIGNATURE = 0x20; // 32
/** InvalidInstructionDataTooShort: Instruction data is too short */
const SWIG_ERROR__INVALID_INSTRUCTION_DATA_TOO_SHORT = 0x21; // 33
/** OwnerMismatchSubAccount: Sub-account owner mismatch */
const SWIG_ERROR__OWNER_MISMATCH_SUB_ACCOUNT = 0x22; // 34
/** SubAccountAlreadyExists: Sub-account already exists */
const SWIG_ERROR__SUB_ACCOUNT_ALREADY_EXISTS = 0x23; // 35
/** AuthorityCannotCreateSubAccount: Authority cannot create sub-account */
const SWIG_ERROR__AUTHORITY_CANNOT_CREATE_SUB_ACCOUNT = 0x24; // 36
/** InvalidSwigSubAccountDiscriminator: Invalid discriminator in sub-account data */
const SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISCRIMINATOR = 0x25; // 37
/** InvalidSwigSubAccountDisabled: Sub-account is disabled */
const SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISABLED = 0x26; // 38
/** InvalidSwigSubAccountSwigIdMismatch: Sub-account Swig ID mismatch */
const SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_SWIG_ID_MISMATCH = 0x27; // 39
/** InvalidSwigSubAccountRoleIdMismatch: Sub-account role ID mismatch */
const SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_ROLE_ID_MISMATCH = 0x28; // 40
/** InvalidSwigTokenAccountOwner: Invalid token account owner */
const SWIG_ERROR__INVALID_SWIG_TOKEN_ACCOUNT_OWNER = 0x29; // 41
/** InvalidProgramScopeBalanceFields: Invalid program scope balance field configuration */
const SWIG_ERROR__INVALID_PROGRAM_SCOPE_BALANCE_FIELDS = 0x2a; // 42
/** AccountDataModifiedUnexpectedly: Account data was modified in unexpected ways during instruction execution */
const SWIG_ERROR__ACCOUNT_DATA_MODIFIED_UNEXPECTEDLY = 0x2b; // 43
/** PermissionDeniedCannotUpdateRootAuthority: Cannot update root authority (ID 0) */
const SWIG_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY = 0x2c; // 44
/** SignV1CannotBeUsedWithSwigV2: SignV1 instruction cannot be used with Swig v2 accounts */
const SWIG_ERROR__SIGN_V1_CANNOT_BE_USED_WITH_SWIG_V2 = 0x2d; // 45
/** SignV2CannotBeUsedWithSwigV1: SignV2 instruction cannot be used with Swig v1 accounts */
const SWIG_ERROR__SIGN_V2_CANNOT_BE_USED_WITH_SWIG_V1 = 0x2e; // 46
/** InvalidSubAccountIndex: Invalid sub-account index (must be 0-254) */
const SWIG_ERROR__INVALID_SUB_ACCOUNT_INDEX = 0x2f; // 47
/** SubAccountIndexMismatch: Sub-account index mismatch between action and instruction */
const SWIG_ERROR__SUB_ACCOUNT_INDEX_MISMATCH = 0x30; // 48
/** SubAccountActionNotFound: Sub-account action not found for the specified index */
const SWIG_ERROR__SUB_ACCOUNT_ACTION_NOT_FOUND = 0x31; // 49

// ============================================================================
// SwigStateError (1000-1007): State management errors from state/src/lib.rs
// ============================================================================

/** InvalidAccountData: Account data is invalid or corrupted */
const SWIG_STATE_ERROR__INVALID_ACCOUNT_DATA = 0x3e8; // 1000
/** InvalidActionData: Action data is invalid or malformed */
const SWIG_STATE_ERROR__INVALID_ACTION_DATA = 0x3e9; // 1001
/** InvalidAuthorityData: Authority data is invalid or malformed */
const SWIG_STATE_ERROR__INVALID_AUTHORITY_DATA = 0x3ea; // 1002
/** InvalidRoleData: Role data is invalid or malformed */
const SWIG_STATE_ERROR__INVALID_ROLE_DATA = 0x3eb; // 1003
/** InvalidSwigData: Swig account data is invalid or malformed */
const SWIG_STATE_ERROR__INVALID_SWIG_DATA = 0x3ec; // 1004
/** RoleNotFound: Specified role could not be found */
const SWIG_STATE_ERROR__ROLE_NOT_FOUND = 0x3ed; // 1005
/** PermissionLoadError: Error loading permissions */
const SWIG_STATE_ERROR__PERMISSION_LOAD_ERROR = 0x3ee; // 1006
/** InvalidAuthorityMustHaveAtLeastOneAction: Adding an authority requires at least one action */
const SWIG_STATE_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION = 0x3ef; // 1007

// ============================================================================
// SwigAuthenticateError (3000-3032): Authentication errors from state/src/lib.rs
// ============================================================================

/** InvalidAuthority: Invalid authority provided */
const SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY = 0xbb8; // 3000
/** InvalidAuthorityPayload: Invalid authority payload format */
const SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_PAYLOAD = 0xbb9; // 3001
/** InvalidDataPayload: Invalid data payload format */
const SWIG_AUTHENTICATE_ERROR__INVALID_DATA_PAYLOAD = 0xbba; // 3002
/** InvalidAuthorityEd25519MissingAuthorityAccount: Missing Ed25519 authority account */
const SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_ED25519_MISSING_AUTHORITY_ACCOUNT = 0xbbb; // 3003
/** AuthorityDoesNotSupportSessionBasedAuth: Authority does not support session-based authentication */
const SWIG_AUTHENTICATE_ERROR__AUTHORITY_DOES_NOT_SUPPORT_SESSION_BASED_AUTH = 0xbbc; // 3004
/** PermissionDenied: Generic permission denied error */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED = 0xbbd; // 3005
/** PermissionDeniedMissingPermission: Missing required permission */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_MISSING_PERMISSION = 0xbbe; // 3006
/** PermissionDeniedTokenAccountPermissionFailure: Token account permission check failed */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_PERMISSION_FAILURE = 0xbbf; // 3007
/** PermissionDeniedTokenAccountDelegatePresent: Token account has an active delegate or close authority */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_DELEGATE_PRESENT = 0xbc0; // 3008
/** PermissionDeniedTokenAccountNotInitialized: Token account is not initialized */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_NOT_INITIALIZED = 0xbc1; // 3009
/** PermissionDeniedToManageAuthority: No permission to manage authority */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TO_MANAGE_AUTHORITY = 0xbc2; // 3010
/** PermissionDeniedInsufficientBalance: Insufficient balance for operation */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_INSUFFICIENT_BALANCE = 0xbc3; // 3011
/** PermissionDeniedCannotRemoveRootAuthority: Cannot remove root authority */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_REMOVE_ROOT_AUTHORITY = 0xbc4; // 3012
/** PermissionDeniedCannotUpdateRootAuthority: Cannot update root authority */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY = 0xbc5; // 3013
/** PermissionDeniedSessionExpired: Session has expired */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SESSION_EXPIRED = 0xbc6; // 3014
/** PermissionDeniedSecp256k1InvalidSignature: Invalid Secp256k1 signature */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE = 0xbc7; // 3015
/** PermissionDeniedSecp256k1InvalidSignatureAge: Secp256k1 signature age is invalid */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE_AGE = 0xbc8; // 3016
/** PermissionDeniedSecp256k1SignatureReused: Secp256k1 signature has been reused */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_SIGNATURE_REUSED = 0xbc9; // 3017
/** PermissionDeniedSecp256k1InvalidHash: Invalid Secp256k1 hash */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_HASH = 0xbca; // 3018
/** PermissionDeniedSecp256r1SignatureReused: Secp256r1 signature has been reused */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_SIGNATURE_REUSED = 0xbcb; // 3019
/** PermissionDeniedStakeAccountInvalidState: Stake account is in an invalid state */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_STAKE_ACCOUNT_INVALID_STATE = 0xbcc; // 3020
/** InvalidSessionKeyCannotReuseSessionKey: Cannot reuse session key */
const SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_KEY_CANNOT_REUSE_SESSION_KEY = 0xbcd; // 3021
/** InvalidSessionDuration: Invalid session duration */
const SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_DURATION = 0xbce; // 3022
/** PermissionDeniedTokenAccountAuthorityNotSwig: Token account authority is not the Swig account */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_AUTHORITY_NOT_SWIG = 0xbcf; // 3023
/** PermissionDeniedSecp256r1InvalidInstruction: Invalid Secp256r1 instruction */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_INSTRUCTION = 0xbd0; // 3024
/** PermissionDeniedSecp256r1InvalidPubkey: Invalid Secp256r1 public key */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_PUBKEY = 0xbd1; // 3025
/** PermissionDeniedSecp256r1InvalidMessageHash: Invalid Secp256r1 message hash */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE_HASH = 0xbd2; // 3026
/** PermissionDeniedSecp256r1InvalidMessage: Invalid Secp256r1 message */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE = 0xbd3; // 3027
/** PermissionDeniedSecp256r1InvalidAuthenticationKind: Invalid Secp256r1 authentication kind */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_AUTHENTICATION_KIND = 0xbd4; // 3028
/** PermissionDeniedSolDestinationLimitExceeded: SOL destination limit exceeded */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_LIMIT_EXCEEDED = 0xbd5; // 3029
/** PermissionDeniedSolDestinationRecurringLimitExceeded: SOL destination recurring limit exceeded */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_RECURRING_LIMIT_EXCEEDED = 0xbd6; // 3030
/** PermissionDeniedTokenDestinationLimitExceeded: Token destination limit exceeded */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_DESTINATION_LIMIT_EXCEEDED = 0xbd7; // 3031
/** PermissionDeniedRecurringTokenDestinationLimitExceeded: Token destination recurring limit exceeded */
const SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_RECURRING_TOKEN_DESTINATION_LIMIT_EXCEEDED = 0xbd8; // 3032

// ============================================================================
// Combined Error Type
// ============================================================================

export type SwigError =
  // SwigError (0-49)
  | typeof SWIG_ERROR__INVALID_SWIG_ACCOUNT_DISCRIMINATOR
  | typeof SWIG_ERROR__OWNER_MISMATCH_SWIG_ACCOUNT
  | typeof SWIG_ERROR__ACCOUNT_NOT_EMPTY_SWIG_ACCOUNT
  | typeof SWIG_ERROR__NOT_ON_CURVE_SWIG_ACCOUNT
  | typeof SWIG_ERROR__EXPECTED_SIGNER_SWIG_ACCOUNT
  | typeof SWIG_ERROR__STATE_ERROR
  | typeof SWIG_ERROR__ACCOUNT_BORROW_FAILED
  | typeof SWIG_ERROR__INVALID_AUTHORITY_TYPE
  | typeof SWIG_ERROR__CPI
  | typeof SWIG_ERROR__INVALID_SEED_SWIG_ACCOUNT
  | typeof SWIG_ERROR__MISSING_INSTRUCTIONS
  | typeof SWIG_ERROR__INVALID_AUTHORITY_PAYLOAD
  | typeof SWIG_ERROR__INVALID_AUTHORITY_NOT_FOUND_BY_ROLE_ID
  | typeof SWIG_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION
  | typeof SWIG_ERROR__INSTRUCTION_EXECUTION_ERROR
  | typeof SWIG_ERROR__SERIALIZATION_ERROR
  | typeof SWIG_ERROR__INVALID_SWIG_SIGN_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_SWIG_REMOVE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_SWIG_ADD_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_SWIG_UPDATE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_SWIG_CREATE_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_SWIG_CREATE_SESSION_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__INVALID_ACCOUNTS_LENGTH
  | typeof SWIG_ERROR__INVALID_ACCOUNTS_SWIG_MUST_BE_FIRST
  | typeof SWIG_ERROR__INVALID_SYSTEM_PROGRAM
  | typeof SWIG_ERROR__DUPLICATE_AUTHORITY
  | typeof SWIG_ERROR__INVALID_OPERATION
  | typeof SWIG_ERROR__INVALID_ALIGNMENT
  | typeof SWIG_ERROR__INVALID_SEED_SUB_ACCOUNT
  | typeof SWIG_ERROR__INSUFFICIENT_FUNDS
  | typeof SWIG_ERROR__OWNER_MISMATCH_TOKEN_ACCOUNT
  | typeof SWIG_ERROR__PERMISSION_DENIED
  | typeof SWIG_ERROR__INVALID_SIGNATURE
  | typeof SWIG_ERROR__INVALID_INSTRUCTION_DATA_TOO_SHORT
  | typeof SWIG_ERROR__OWNER_MISMATCH_SUB_ACCOUNT
  | typeof SWIG_ERROR__SUB_ACCOUNT_ALREADY_EXISTS
  | typeof SWIG_ERROR__AUTHORITY_CANNOT_CREATE_SUB_ACCOUNT
  | typeof SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISCRIMINATOR
  | typeof SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISABLED
  | typeof SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_SWIG_ID_MISMATCH
  | typeof SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_ROLE_ID_MISMATCH
  | typeof SWIG_ERROR__INVALID_SWIG_TOKEN_ACCOUNT_OWNER
  | typeof SWIG_ERROR__INVALID_PROGRAM_SCOPE_BALANCE_FIELDS
  | typeof SWIG_ERROR__ACCOUNT_DATA_MODIFIED_UNEXPECTEDLY
  | typeof SWIG_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY
  | typeof SWIG_ERROR__SIGN_V1_CANNOT_BE_USED_WITH_SWIG_V2
  | typeof SWIG_ERROR__SIGN_V2_CANNOT_BE_USED_WITH_SWIG_V1
  | typeof SWIG_ERROR__INVALID_SUB_ACCOUNT_INDEX
  | typeof SWIG_ERROR__SUB_ACCOUNT_INDEX_MISMATCH
  | typeof SWIG_ERROR__SUB_ACCOUNT_ACTION_NOT_FOUND
  // SwigStateError (1000-1007)
  | typeof SWIG_STATE_ERROR__INVALID_ACCOUNT_DATA
  | typeof SWIG_STATE_ERROR__INVALID_ACTION_DATA
  | typeof SWIG_STATE_ERROR__INVALID_AUTHORITY_DATA
  | typeof SWIG_STATE_ERROR__INVALID_ROLE_DATA
  | typeof SWIG_STATE_ERROR__INVALID_SWIG_DATA
  | typeof SWIG_STATE_ERROR__ROLE_NOT_FOUND
  | typeof SWIG_STATE_ERROR__PERMISSION_LOAD_ERROR
  | typeof SWIG_STATE_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION
  // SwigAuthenticateError (3000-3032)
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_PAYLOAD
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_DATA_PAYLOAD
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_ED25519_MISSING_AUTHORITY_ACCOUNT
  | typeof SWIG_AUTHENTICATE_ERROR__AUTHORITY_DOES_NOT_SUPPORT_SESSION_BASED_AUTH
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_MISSING_PERMISSION
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_PERMISSION_FAILURE
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_DELEGATE_PRESENT
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_NOT_INITIALIZED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TO_MANAGE_AUTHORITY
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_INSUFFICIENT_BALANCE
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_REMOVE_ROOT_AUTHORITY
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SESSION_EXPIRED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE_AGE
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_SIGNATURE_REUSED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_HASH
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_SIGNATURE_REUSED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_STAKE_ACCOUNT_INVALID_STATE
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_KEY_CANNOT_REUSE_SESSION_KEY
  | typeof SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_DURATION
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_AUTHORITY_NOT_SWIG
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_INSTRUCTION
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_PUBKEY
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE_HASH
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_AUTHENTICATION_KIND
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_LIMIT_EXCEEDED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_RECURRING_LIMIT_EXCEEDED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_DESTINATION_LIMIT_EXCEEDED
  | typeof SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_RECURRING_TOKEN_DESTINATION_LIMIT_EXCEEDED;

let swigErrorMessages: Record<SwigError, string> | undefined;
if (process.env.NODE_ENV !== 'production') {
  swigErrorMessages = {
    // SwigError (0-49)
    [SWIG_ERROR__INVALID_SWIG_ACCOUNT_DISCRIMINATOR]: `Invalid discriminator in Swig account data`,
    [SWIG_ERROR__OWNER_MISMATCH_SWIG_ACCOUNT]: `Swig account owner does not match expected value`,
    [SWIG_ERROR__ACCOUNT_NOT_EMPTY_SWIG_ACCOUNT]: `Swig account is not empty when it should be`,
    [SWIG_ERROR__NOT_ON_CURVE_SWIG_ACCOUNT]: `Public key in Swig account is not on the curve`,
    [SWIG_ERROR__EXPECTED_SIGNER_SWIG_ACCOUNT]: `Expected Swig account to be a signer but it isn't`,
    [SWIG_ERROR__STATE_ERROR]: `General state error in program execution`,
    [SWIG_ERROR__ACCOUNT_BORROW_FAILED]: `Failed to borrow account data`,
    [SWIG_ERROR__INVALID_AUTHORITY_TYPE]: `Invalid authority type specified`,
    [SWIG_ERROR__CPI]: `Error during cross-program invocation`,
    [SWIG_ERROR__INVALID_SEED_SWIG_ACCOUNT]: `Invalid seed used for Swig account derivation`,
    [SWIG_ERROR__MISSING_INSTRUCTIONS]: `Required instructions are missing`,
    [SWIG_ERROR__INVALID_AUTHORITY_PAYLOAD]: `Invalid authority payload format`,
    [SWIG_ERROR__INVALID_AUTHORITY_NOT_FOUND_BY_ROLE_ID]: `Authority not found for given role ID`,
    [SWIG_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION]: `Authority must have at least one action`,
    [SWIG_ERROR__INSTRUCTION_EXECUTION_ERROR]: `Error during instruction execution`,
    [SWIG_ERROR__SERIALIZATION_ERROR]: `Error during data serialization`,
    [SWIG_ERROR__INVALID_SWIG_SIGN_INSTRUCTION_DATA_TOO_SHORT]: `Sign instruction data is too short`,
    [SWIG_ERROR__INVALID_SWIG_REMOVE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT]: `Remove authority instruction data is too short`,
    [SWIG_ERROR__INVALID_SWIG_ADD_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT]: `Add authority instruction data is too short`,
    [SWIG_ERROR__INVALID_SWIG_UPDATE_AUTHORITY_INSTRUCTION_DATA_TOO_SHORT]: `Update authority instruction data is too short`,
    [SWIG_ERROR__INVALID_SWIG_CREATE_INSTRUCTION_DATA_TOO_SHORT]: `Create instruction data is too short`,
    [SWIG_ERROR__INVALID_SWIG_CREATE_SESSION_INSTRUCTION_DATA_TOO_SHORT]: `Create session instruction data is too short`,
    [SWIG_ERROR__INVALID_ACCOUNTS_LENGTH]: `Invalid number of accounts provided`,
    [SWIG_ERROR__INVALID_ACCOUNTS_SWIG_MUST_BE_FIRST]: `Swig account must be the first account in the list`,
    [SWIG_ERROR__INVALID_SYSTEM_PROGRAM]: `Invalid system program account`,
    [SWIG_ERROR__DUPLICATE_AUTHORITY]: `Authority already exists`,
    [SWIG_ERROR__INVALID_OPERATION]: `Invalid operation attempted`,
    [SWIG_ERROR__INVALID_ALIGNMENT]: `Data alignment error`,
    [SWIG_ERROR__INVALID_SEED_SUB_ACCOUNT]: `Invalid seed used for sub-account derivation`,
    [SWIG_ERROR__INSUFFICIENT_FUNDS]: `Insufficient funds for operation`,
    [SWIG_ERROR__OWNER_MISMATCH_TOKEN_ACCOUNT]: `Token account owner mismatch`,
    [SWIG_ERROR__PERMISSION_DENIED]: `Permission denied for operation`,
    [SWIG_ERROR__INVALID_SIGNATURE]: `Invalid signature provided`,
    [SWIG_ERROR__INVALID_INSTRUCTION_DATA_TOO_SHORT]: `Instruction data is too short`,
    [SWIG_ERROR__OWNER_MISMATCH_SUB_ACCOUNT]: `Sub-account owner mismatch`,
    [SWIG_ERROR__SUB_ACCOUNT_ALREADY_EXISTS]: `Sub-account already exists`,
    [SWIG_ERROR__AUTHORITY_CANNOT_CREATE_SUB_ACCOUNT]: `Authority cannot create sub-account`,
    [SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISCRIMINATOR]: `Invalid discriminator in sub-account data`,
    [SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_DISABLED]: `Sub-account is disabled`,
    [SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_SWIG_ID_MISMATCH]: `Sub-account Swig ID mismatch`,
    [SWIG_ERROR__INVALID_SWIG_SUB_ACCOUNT_ROLE_ID_MISMATCH]: `Sub-account role ID mismatch`,
    [SWIG_ERROR__INVALID_SWIG_TOKEN_ACCOUNT_OWNER]: `Invalid token account owner`,
    [SWIG_ERROR__INVALID_PROGRAM_SCOPE_BALANCE_FIELDS]: `Invalid program scope balance field configuration`,
    [SWIG_ERROR__ACCOUNT_DATA_MODIFIED_UNEXPECTEDLY]: `Account data was modified in unexpected ways during instruction execution`,
    [SWIG_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY]: `Cannot update root authority (ID 0)`,
    [SWIG_ERROR__SIGN_V1_CANNOT_BE_USED_WITH_SWIG_V2]: `SignV1 instruction cannot be used with Swig v2 accounts`,
    [SWIG_ERROR__SIGN_V2_CANNOT_BE_USED_WITH_SWIG_V1]: `SignV2 instruction cannot be used with Swig v1 accounts`,
    [SWIG_ERROR__INVALID_SUB_ACCOUNT_INDEX]: `Invalid sub-account index (must be 0-254)`,
    [SWIG_ERROR__SUB_ACCOUNT_INDEX_MISMATCH]: `Sub-account index mismatch between action and instruction`,
    [SWIG_ERROR__SUB_ACCOUNT_ACTION_NOT_FOUND]: `Sub-account action not found for the specified index. Note: Sub-account indices do NOT need to be sequential - they can be created in any order (e.g., 0, 5, 2, 10)`,
    // SwigStateError (1000-1007)
    [SWIG_STATE_ERROR__INVALID_ACCOUNT_DATA]: `Account data is invalid or corrupted`,
    [SWIG_STATE_ERROR__INVALID_ACTION_DATA]: `Action data is invalid or malformed`,
    [SWIG_STATE_ERROR__INVALID_AUTHORITY_DATA]: `Authority data is invalid or malformed`,
    [SWIG_STATE_ERROR__INVALID_ROLE_DATA]: `Role data is invalid or malformed`,
    [SWIG_STATE_ERROR__INVALID_SWIG_DATA]: `Swig account data is invalid or malformed`,
    [SWIG_STATE_ERROR__ROLE_NOT_FOUND]: `Specified role could not be found`,
    [SWIG_STATE_ERROR__PERMISSION_LOAD_ERROR]: `Error loading permissions`,
    [SWIG_STATE_ERROR__INVALID_AUTHORITY_MUST_HAVE_AT_LEAST_ONE_ACTION]: `Adding an authority requires at least one action`,
    // SwigAuthenticateError (3000-3032)
    [SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY]: `Invalid authority provided`,
    [SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_PAYLOAD]: `Invalid authority payload format`,
    [SWIG_AUTHENTICATE_ERROR__INVALID_DATA_PAYLOAD]: `Invalid data payload format`,
    [SWIG_AUTHENTICATE_ERROR__INVALID_AUTHORITY_ED25519_MISSING_AUTHORITY_ACCOUNT]: `Missing Ed25519 authority account`,
    [SWIG_AUTHENTICATE_ERROR__AUTHORITY_DOES_NOT_SUPPORT_SESSION_BASED_AUTH]: `Authority does not support session-based authentication`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED]: `Generic permission denied error`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_MISSING_PERMISSION]: `Missing required permission`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_PERMISSION_FAILURE]: `Token account permission check failed`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_DELEGATE_PRESENT]: `Token account has an active delegate or close authority`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_NOT_INITIALIZED]: `Token account is not initialized`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TO_MANAGE_AUTHORITY]: `No permission to manage authority`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_INSUFFICIENT_BALANCE]: `Insufficient balance for operation`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_REMOVE_ROOT_AUTHORITY]: `Cannot remove root authority`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_CANNOT_UPDATE_ROOT_AUTHORITY]: `Cannot update root authority`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SESSION_EXPIRED]: `Session has expired`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE]: `Invalid Secp256k1 signature`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_SIGNATURE_AGE]: `Secp256k1 signature age is invalid`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_SIGNATURE_REUSED]: `Secp256k1 signature has been reused`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256K1_INVALID_HASH]: `Invalid Secp256k1 hash`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_SIGNATURE_REUSED]: `Secp256r1 signature has been reused`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_STAKE_ACCOUNT_INVALID_STATE]: `Stake account is in an invalid state`,
    [SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_KEY_CANNOT_REUSE_SESSION_KEY]: `Cannot reuse session key`,
    [SWIG_AUTHENTICATE_ERROR__INVALID_SESSION_DURATION]: `Invalid session duration`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_ACCOUNT_AUTHORITY_NOT_SWIG]: `Token account authority is not the Swig account`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_INSTRUCTION]: `Invalid Secp256r1 instruction`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_PUBKEY]: `Invalid Secp256r1 public key`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE_HASH]: `Invalid Secp256r1 message hash`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_MESSAGE]: `Invalid Secp256r1 message`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SECP256R1_INVALID_AUTHENTICATION_KIND]: `Invalid Secp256r1 authentication kind`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_LIMIT_EXCEEDED]: `SOL destination limit exceeded`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_SOL_DESTINATION_RECURRING_LIMIT_EXCEEDED]: `SOL destination recurring limit exceeded`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_TOKEN_DESTINATION_LIMIT_EXCEEDED]: `Token destination limit exceeded`,
    [SWIG_AUTHENTICATE_ERROR__PERMISSION_DENIED_RECURRING_TOKEN_DESTINATION_LIMIT_EXCEEDED]: `Token destination recurring limit exceeded`,
  };
}

/**
 * Get the error message for a Swig error code.
 * Supports all error ranges: SwigError (0-49), SwigStateError (1000-1007), and SwigAuthenticateError (3000-3032).
 *
 * @param code - The error code to get the message for
 * @returns The error message string
 *
 * @example
 * ```ts
 * const message = getSwigErrorMessage(47); // "Invalid sub-account index (must be 0-254)"
 * const stateMsg = getSwigErrorMessage(1000); // "Account data is invalid or corrupted"
 * const authMsg = getSwigErrorMessage(3005); // "Generic permission denied error"
 * ```
 */
export function getSwigErrorMessage(code: SwigError): string {
  if (process.env.NODE_ENV !== 'production') {
    return (swigErrorMessages as Record<SwigError, string>)[code];
  }

  return 'Error message not available in production bundles.';
}
