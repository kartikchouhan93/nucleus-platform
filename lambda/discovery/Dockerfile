FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for PyIceberg/PyArrow if needed (e.g., git, build-essential)
# For pure python wheels, often not needed, but good for safety
# RUN yum install -y ...

# Copy requirements
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY discovery.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done for ECS, but this makes it compatible with Lambda Base image)
CMD [ "discovery.handler" ]
