curl -L -X POST 'https://api.turso.tech/v1/organizations/personal/databases/dumps' \
  -H "Authorization: " \
  -F 'file=@"./dump.sql"'
