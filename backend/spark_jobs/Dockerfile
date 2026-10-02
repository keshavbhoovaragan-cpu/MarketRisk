FROM apache/spark:4.0.1

USER root
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
  PYSPARK_PYTHON=python3 \
  PYTHONPATH=/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.9-src.zip

RUN curl -fsSL https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.4.1/hadoop-aws-3.4.1.jar \
      -o /opt/spark/jars/hadoop-aws-3.4.1.jar \
    && curl -fsSL https://repo1.maven.org/maven2/software/amazon/awssdk/bundle/2.24.6/bundle-2.24.6.jar \
      -o /opt/spark/jars/bundle-2.24.6.jar

WORKDIR /opt/marketrisk
COPY spark_jobs/requirements.txt ./requirements.txt
RUN python3 -m pip install --no-cache-dir -r requirements.txt

COPY spark_jobs/ ./spark_jobs/
RUN chown -R spark:spark /opt/marketrisk

USER 185:185
