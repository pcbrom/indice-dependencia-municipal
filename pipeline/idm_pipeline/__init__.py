"""idm_pipeline: ingestion, IDM computation, validation and artifact publication.

The IDM formula lives in idm_core (pure, IO-free). The flow scripts (regic,
finbra, idm, malha, manifesto) wrap it with reading and writing. Importing this
package has no side effects; every script guards execution under __main__.
"""

__version__ = "1.0.0"

# IDM specification version, mirrored into the manifest.
IDM_VERSION = "1.0"
