"""
Luminess Web Django application package.
Initializes PyMySQL as MySQLdb driver for native MariaDB/MySQL support.
"""
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass
