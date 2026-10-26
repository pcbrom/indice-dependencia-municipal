# IDM pipeline image: reproducible Python 3.12 environment with geopandas and
# tippecanoe. Runs the data pipeline (ingestion, IBGE key standardization, IDM,
# PMTiles mesh) so the build produces identical static artifacts anywhere.
#
# No secrets are baked in. Raw data lives outside version control (data/raw/)
# and is bind-mounted at run time, never copied into the image layers.

FROM python:3.12-slim-bookworm

# System deps: build toolchain for tippecanoe, plus GDAL/GEOS/PROJ runtime that
# geopandas relies on. Pinned apt install kept minimal; wheels bring the Python
# bindings so we only need the shared libraries here.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        ca-certificates \
        zlib1g-dev \
        libsqlite3-dev \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Build tippecanoe from source. Debian bookworm has no tippecanoe apt package,
# so we compile the maintained fork (felt/tippecanoe) at a pinned tag for
# reproducibility. Bump TIPPECANOE_REF deliberately, never float on main.
ARG TIPPECANOE_REF=2.72.0
RUN git clone --depth 1 --branch ${TIPPECANOE_REF} \
        https://github.com/felt/tippecanoe.git /tmp/tippecanoe \
    && make -C /tmp/tippecanoe -j "$(nproc)" \
    && make -C /tmp/tippecanoe install \
    && rm -rf /tmp/tippecanoe

# Python deps. Pinned in requirements.txt when present; otherwise install the
# geospatial core explicitly. The list mirrors pyproject.toml (pandas, geopandas,
# pyarrow, requests) plus the geospatial IO and spreadsheet readers the flow
# scripts need. Versions are pinned to keep the build reproducible; requests is
# required by the source fetchers and must not be omitted from this branch.
WORKDIR /pipeline
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then \
        pip install --no-cache-dir -r requirements.txt ; \
    else \
        pip install --no-cache-dir \
            "pandas==2.2.3" \
            "geopandas==1.0.1" \
            "pyogrio==0.10.0" \
            "shapely==2.0.6" \
            "openpyxl==3.1.5" \
            "pyarrow==18.1.0" \
            "requests==2.32.3" ; \
    fi

# Pipeline scripts (regic.py, idm.py, malha.py, manifesto.py). Copied last so
# code changes do not invalidate the dependency layers above.
COPY . /pipeline

# data/raw and app/public/data are bind-mounted by the caller (CI or local),
# keeping raw sources and generated artifacts out of the image.
# Example run:
#   docker run --rm \
#     -v "$PWD/data:/data" \
#     -v "$PWD/app/public/data:/pipeline/out" \
#     idm-pipeline python build.py
#
# Default command is a no-op help so the image never runs a pipeline implicitly.
CMD ["python", "-c", "print('IDM pipeline image. Invoke a pipeline script, e.g. python build.py')"]
